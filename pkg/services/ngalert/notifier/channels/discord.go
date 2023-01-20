package channels

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/notifications"
)

type DiscordNotifier struct {
	*Base
	log                log.Logger
	ns                 notifications.WebhookSender
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

func DiscrodFactory(fc FactoryConfig) (NotificationChannel, error) {
	cfg, err := NewDiscordConfig(fc.Config)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewDiscordNotifier(cfg, fc.NotificationService, fc.Template), nil
}

func NewDiscordNotifier(config *DiscordConfig, ns notifications.WebhookSender, t *template.Template) *DiscordNotifier {
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
	}

	if d.AvatarURL != "" {
		bodyJSON.Set("avatar_url", tmpl(d.AvatarURL))
	}

	footer := map[string]interface{}{
		"text":     LogzioFooterText,
		"icon_url": LogzioIconUrl,
	}

	embed := simplejson.New()
	embed.Set("title", tmpl(DefaultMessageTitleEmbed))
	embed.Set("footer", footer)
	embed.Set("type", "rich")

	color, _ := strconv.ParseInt(strings.TrimLeft(getAlertStatusColor(alerts.Status()), "#"), 16, 0)
	embed.Set("color", color)

	//LOGZ.IO GRAFANA CHANGE :: DEV-37746: Add switch to account query param
	basePath := ToBasePathWithAccountRedirect(d.tmpl.ExternalURL, alerts)
	ruleURL := joinUrlPath(basePath, "/alerting/list", d.log)
	//LOGZ.IO GRAFANA CHANGE :: end
	embed.Set("url", ToLogzioAppPath(ruleURL)) // LOGZ.IO GRAFANA CHANGE :: DEV-31554 - Set APP url to logzio grafana for alert notification URLs

	bodyJSON.Set("embeds", []interface{}{embed})

	u := tmpl(d.WebhookURL)
	if tmplErr != nil {
		d.log.Warn("failed to template Discord message", "err", tmplErr.Error())
		return false, tmplErr
	}

	body, err := json.Marshal(bodyJSON)
	if err != nil {
		return false, err
	}
	cmd := &models.SendWebhookSync{
		Url:         u,
		HttpMethod:  "POST",
		ContentType: "application/json",
		Body:        string(body),
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
