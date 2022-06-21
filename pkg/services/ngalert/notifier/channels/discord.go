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
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
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
		d.log.Error("failed to send notification to Discord", "err", err)
		return false, err
	}
	return true, nil
}

func (d DiscordNotifier) SendResolved() bool {
	return !d.GetDisableResolveMessage()
}

func (d DiscordNotifier) constructAttachments(ctx context.Context, as []*types.Alert, embedQuota int) []discordAttachment {
	attachments := make([]discordAttachment, 0)

	_ = withStoredImages(ctx, d.log, d.images,
		func(index int, image *ngmodels.Image) error {
			if embedQuota < 1 {
				return ErrImagesDone
			}

			if image == nil {
				return nil
			}

			if len(image.URL) > 0 {
				attachments = append(attachments, discordAttachment{
					url:       image.URL,
					state:     as[index].Status(),
					alertName: as[index].Name(),
				})
				embedQuota--
				return nil
			}

			// If we have a local file, but no public URL, upload the image as an attachment.
			if len(image.Path) > 0 {
				base := filepath.Base(image.Path)
				url := fmt.Sprintf("attachment://%s", base)
				reader, err := openImage(image.Path)
				if err != nil && !errors.Is(err, ngmodels.ErrImageNotFound) {
					d.log.Warn("failed to retrieve image data from store", "err", err)
					return nil
				}

				attachments = append(attachments, discordAttachment{
					url:       url,
					name:      base,
					reader:    reader,
					state:     as[index].Status(),
					alertName: as[index].Name(),
				})
				embedQuota--
			}
			return nil
		},
		as...,
	)

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
			d.log.Warn("failed to close multipart writer", "err", err)
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
		if a.reader != nil { // We have an image to upload.
			err = func() error {
				defer func() { _ = a.reader.Close() }()
				part, err := w.CreateFormFile("", a.name)
				if err != nil {
					return err
				}
				_, err = io.Copy(part, a.reader)
				return err
			}()
			if err != nil {
				return nil, err
			}
		}
	}

	if err := w.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	cmd.ContentType = w.FormDataContentType()
	cmd.Body = b.String()
	return cmd, nil
}
