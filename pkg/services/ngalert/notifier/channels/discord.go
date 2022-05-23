package channels

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
)

type DiscordNotifier struct {
	*Base
	log                log.Logger
	ns                 notifications.WebhookSender
	images             ImageStore
	tmpl               *template.Template
	Content            string
	AvatarURL          string
	WebhookURL         string
	UseDiscordUsername bool
}

type DiscordConfig struct {
	*NotificationChannelConfig
	Content            string
	AvatarURL          string
	WebhookURL         string
	UseDiscordUsername bool
}

type discordAttachment struct {
	url       string
	reader    io.ReadCloser
	name      string
	alertName string
	state     model.AlertStatus
}

const DiscordMaxEmbeds = 10

func NewDiscordConfig(config *NotificationChannelConfig) (*DiscordConfig, error) {
	discordURL := config.Settings.Get("url").MustString()
	if discordURL == "" {
		return nil, errors.New("could not find webhook url property in settings")
	}
	return &DiscordConfig{
		NotificationChannelConfig: config,
		Content:                   config.Settings.Get("message").MustString(`{{ template "default.message" . }}`),
		AvatarURL:                 config.Settings.Get("avatar_url").MustString(),
		WebhookURL:                discordURL,
		UseDiscordUsername:        config.Settings.Get("use_discord_username").MustBool(false),
	}, nil
}

func DiscordFactory(fc FactoryConfig) (NotificationChannel, error) {
	cfg, err := NewDiscordConfig(fc.Config)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewDiscordNotifier(cfg, fc.NotificationService, fc.ImageStore, fc.Template), nil
}

func NewDiscordNotifier(config *DiscordConfig, ns notifications.WebhookSender, images ImageStore, t *template.Template) *DiscordNotifier {
	return &DiscordNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   config.UID,
			Name:                  config.Name,
			Type:                  config.Type,
			DisableResolveMessage: config.DisableResolveMessage,
			Settings:              config.Settings,
			SecureSettings:        config.SecureSettings,
		}),
		Content:            config.Content,
		AvatarURL:          config.AvatarURL,
		WebhookURL:         config.WebhookURL,
		log:                log.New("alerting.notifier.discord"),
		ns:                 ns,
		images:             images,
		tmpl:               t,
		UseDiscordUsername: config.UseDiscordUsername,
	}
}

func (d DiscordNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	alerts := types.Alerts(as...)

	bodyJSON := simplejson.New()

	if !d.UseDiscordUsername {
		bodyJSON.Set("username", "Grafana")
	}

	var tmplErr error
	tmpl, _ := TmplText(ctx, d.tmpl, as, d.log, &tmplErr)

	if d.Content != "" {
		bodyJSON.Set("content", tmpl(d.Content))
		if tmplErr != nil {
			d.log.Warn("failed to template Discord notification content", "err", tmplErr.Error())
			// Reset tmplErr for templating other fields.
			tmplErr = nil
		}
	}

	if d.AvatarURL != "" {
		bodyJSON.Set("avatar_url", tmpl(d.AvatarURL))
		if tmplErr != nil {
			d.log.Warn("failed to template Discord Avatar URL", "err", tmplErr.Error(), "fallback", d.AvatarURL)
			bodyJSON.Set("avatar_url", d.AvatarURL)
			tmplErr = nil
		}
	}

	footer := map[string]interface{}{
		"text":     "Grafana v" + setting.BuildVersion,
		"icon_url": "https://grafana.com/assets/img/fav32.png",
	}

	linkEmbed := simplejson.New()
	linkEmbed.Set("title", tmpl(DefaultMessageTitleEmbed))
	linkEmbed.Set("footer", footer)
	linkEmbed.Set("type", "rich")

	color, _ := strconv.ParseInt(strings.TrimLeft(getAlertStatusColor(alerts.Status()), "#"), 16, 0)
	linkEmbed.Set("color", color)

	ruleURL := joinUrlPath(d.tmpl.ExternalURL.String(), "/alerting/list", d.log)
	linkEmbed.Set("url", ruleURL)

	embeds := []interface{}{linkEmbed}

	attachments := d.constructAttachments(ctx, as, DiscordMaxEmbeds-1)
	for _, a := range attachments {
		color, _ := strconv.ParseInt(strings.TrimLeft(getAlertStatusColor(alerts.Status()), "#"), 16, 0)
		embed := map[string]interface{}{
			"image": map[string]interface{}{
				"url": a.url,
			},
			"color": color,
			"title": a.alertName,
		}
		embeds = append(embeds, embed)
	}

	bodyJSON.Set("embeds", embeds)

	if tmplErr != nil {
		d.log.Warn("failed to template Discord message", "err", tmplErr.Error())
		tmplErr = nil
	}

	u := tmpl(d.WebhookURL)
	if tmplErr != nil {
		d.log.Warn("failed to template Discord URL", "err", tmplErr.Error(), "fallback", d.WebhookURL)
		u = d.WebhookURL
	}

	body, err := json.Marshal(bodyJSON)
	if err != nil {
		return false, err
	}

	cmd, err := d.buildRequest(ctx, u, body, attachments)
	if err != nil {
		return false, err
	}

	if err := d.ns.SendWebhookSync(ctx, cmd); err != nil {
		d.log.Error("Failed to send notification to Discord", "error", err)
		return false, err
	}
	return true, nil
}

func (d DiscordNotifier) SendResolved() bool {
	return !d.GetDisableResolveMessage()
}

func (d DiscordNotifier) constructAttachments(ctx context.Context, as []*types.Alert, embedQuota int) []discordAttachment {
	attachments := make([]discordAttachment, 0)
	for i := range as {
		if embedQuota == 0 {
			break
		}
		imgToken := getTokenFromAnnotations(as[i].Annotations)
		if len(imgToken) == 0 {
			continue
		}

		timeoutCtx, cancel := context.WithTimeout(ctx, ImageStoreTimeout)
		imgURL, err := d.images.GetURL(timeoutCtx, imgToken)
		cancel()
		if err != nil {
			if !errors.Is(err, ErrImagesUnavailable) {
				// Ignore errors. Don't log "ImageUnavailable", which means the storage doesn't exist.
				d.log.Warn("failed to retrieve image url from store", "error", err)
			}
		}

		if len(imgURL) > 0 {
			attachments = append(attachments, discordAttachment{
				url:       imgURL,
				state:     as[i].Status(),
				alertName: as[i].Name(),
			})
		} else {
			// Need to upload the file. Tell Discord that we're embedding an attachment.
			timeoutCtx, cancel := context.WithTimeout(ctx, ImageStoreTimeout)
			fp, err := d.images.GetFilepath(timeoutCtx, imgToken)
			cancel()
			if err != nil {
				if !errors.Is(err, ErrImagesUnavailable) {
					// Ignore errors. Don't log "ImageUnavailable", which means the storage doesn't exist.
					d.log.Warn("failed to retrieve image filepath from store", "error", err)
				}
			}

			base := filepath.Base(fp)
			url := fmt.Sprintf("attachment://%s", base)
			timeoutCtx, cancel = context.WithTimeout(ctx, ImageStoreTimeout)
			reader, err := d.images.GetData(timeoutCtx, imgToken)
			cancel()
			if err != nil {
				if !errors.Is(err, ErrImagesUnavailable) {
					// Ignore errors. Don't log "ImageUnavailable", which means the storage doesn't exist.
					d.log.Warn("failed to retrieve image data from store", "error", err)
				}
			}

			attachments = append(attachments, discordAttachment{
				url:       url,
				name:      base,
				reader:    reader,
				state:     as[i].Status(),
				alertName: as[i].Name(),
			})
		}
		embedQuota++
	}
	return attachments
}

func (d DiscordNotifier) buildRequest(ctx context.Context, url string, body []byte, attachments []discordAttachment) (*models.SendWebhookSync, error) {
	cmd := &models.SendWebhookSync{
		Url:        url,
		HttpMethod: "POST",
	}
	if len(attachments) == 0 {
		cmd.ContentType = "application/json"
		cmd.Body = string(body)
		return cmd, nil
	}

	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	defer func() {
		if err := w.Close(); err != nil {
			// Shouldn't matter since we already close w explicitly on the non-error path
			d.log.Warn("Failed to close multipart writer", "err", err)
		}
	}()

	payload, err := w.CreateFormField("payload_json")
	if err != nil {
		return nil, err
	}
	if _, err := payload.Write(body); err != nil {
		return nil, err
	}
	for _, a := range attachments {
		part, err := w.CreateFormFile("", a.name)
		if err != nil {
			return nil, err
		}
		if _, err := io.Copy(part, a.reader); err != nil {
			return nil, err
		}
	}
	if err := w.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}
	cmd.ContentType = w.FormDataContentType()
	cmd.Body = b.String()
	return cmd, nil
}
