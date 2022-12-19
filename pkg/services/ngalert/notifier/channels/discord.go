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

	"github.com/grafana/alerting/alerting/notifier/channels"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/setting"
)

type DiscordNotifier struct {
	*channels.Base
	log      channels.Logger
	ns       channels.WebhookSender
	images   channels.ImageStore
	tmpl     *template.Template
	settings *discordSettings
}

type discordSettings struct {
	Title              string `json:"title,omitempty" yaml:"title,omitempty"`
	Content            string `json:"message,omitempty" yaml:"message,omitempty"`
	AvatarURL          string `json:"avatar_url,omitempty" yaml:"avatar_url,omitempty"`
	WebhookURL         string `json:"url,omitempty" yaml:"url,omitempty"`
	UseDiscordUsername bool   `json:"use_discord_username,omitempty" yaml:"use_discord_username,omitempty"`
}

func buildDiscordSettings(fc channels.FactoryConfig) (*discordSettings, error) {
	var settings discordSettings
	err := json.Unmarshal(fc.Config.Settings, &settings)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	if settings.WebhookURL == "" {
		return nil, errors.New("could not find webhook url property in settings")
	}
	if settings.Title == "" {
		settings.Title = channels.DefaultMessageTitleEmbed
	}
	if settings.Content == "" {
		settings.Content = channels.DefaultMessageEmbed
	}
	return &settings, nil
}

type discordAttachment struct {
	url       string
	reader    io.ReadCloser
	name      string
	alertName string
	state     model.AlertStatus
}

const DiscordMaxEmbeds = 10

func DiscordFactory(fc channels.FactoryConfig) (channels.NotificationChannel, error) {
	dn, err := newDiscordNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return dn, nil
}

func newDiscordNotifier(fc channels.FactoryConfig) (*DiscordNotifier, error) {
	settings, err := buildDiscordSettings(fc)
	if err != nil {
		return nil, err
	}
	return &DiscordNotifier{
		Base:     channels.NewBase(fc.Config),
		log:      fc.Logger,
		ns:       fc.NotificationService,
		images:   fc.ImageStore,
		tmpl:     fc.Template,
		settings: settings,
	}, nil
}

func (d DiscordNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	alerts := types.Alerts(as...)

	bodyJSON := simplejson.New()

	if !d.settings.UseDiscordUsername {
		bodyJSON.Set("username", "Grafana")
	}

	var tmplErr error
	tmpl, _ := channels.TmplText(ctx, d.tmpl, as, d.log, &tmplErr)

	bodyJSON.Set("content", tmpl(d.settings.Content))
	if tmplErr != nil {
		d.log.Warn("failed to template Discord notification content", "error", tmplErr.Error())
		// Reset tmplErr for templating other fields.
		tmplErr = nil
	}

	if d.settings.AvatarURL != "" {
		bodyJSON.Set("avatar_url", tmpl(d.settings.AvatarURL))
		if tmplErr != nil {
			d.log.Warn("failed to template Discord Avatar URL", "error", tmplErr.Error(), "fallback", d.settings.AvatarURL)
			bodyJSON.Set("avatar_url", d.settings.AvatarURL)
			tmplErr = nil
		}
	}

	footer := map[string]interface{}{
		"text":     "Grafana v" + setting.BuildVersion,
		"icon_url": "https://grafana.com/static/assets/img/fav32.png",
	}

	linkEmbed := simplejson.New()

	linkEmbed.Set("title", tmpl(d.settings.Title))
	if tmplErr != nil {
		d.log.Warn("failed to template Discord notification title", "error", tmplErr.Error())
		// Reset tmplErr for templating other fields.
		tmplErr = nil
	}
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
		d.log.Warn("failed to template Discord message", "error", tmplErr.Error())
		tmplErr = nil
	}

	u := tmpl(d.settings.WebhookURL)
	if tmplErr != nil {
		d.log.Warn("failed to template Discord URL", "error", tmplErr.Error(), "fallback", d.settings.WebhookURL)
		u = d.settings.WebhookURL
	}

	body, err := json.Marshal(bodyJSON)
	if err != nil {
		return false, err
	}

	cmd, err := d.buildRequest(u, body, attachments)
	if err != nil {
		return false, err
	}

	if err := d.ns.SendWebhook(ctx, cmd); err != nil {
		d.log.Error("failed to send notification to Discord", "error", err)
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
		func(index int, image channels.Image) error {
			if embedQuota < 1 {
				return channels.ErrImagesDone
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
				if err != nil && !errors.Is(err, channels.ErrImageNotFound) {
					d.log.Warn("failed to retrieve image data from store", "error", err)
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

func (d DiscordNotifier) buildRequest(url string, body []byte, attachments []discordAttachment) (*channels.SendWebhookSettings, error) {
	cmd := &channels.SendWebhookSettings{
		URL:        url,
		HTTPMethod: "POST",
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
			d.log.Warn("failed to close multipart writer", "error", err)
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
