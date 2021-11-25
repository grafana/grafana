package channels

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

type DiscordNotifier struct {
	*Base
	log                log.Logger
	tmpl               *template.Template
	Content            string
	AvatarURL          string
	WebhookURL         string
	UseDiscordUsername bool
}

func NewDiscordNotifier(model *NotificationChannelConfig, t *template.Template) (*DiscordNotifier, error) {
	if model.Settings == nil {
		return nil, receiverInitError{Cfg: *model, Reason: "no settings supplied"}
	}

	avatarURL := model.Settings.Get("avatar_url").MustString()

	discordURL := model.Settings.Get("url").MustString()
	if discordURL == "" {
		return nil, receiverInitError{Reason: "could not find webhook url property in settings", Cfg: *model}
	}

	useDiscordUsername := model.Settings.Get("use_discord_username").MustBool(false)

	content := model.Settings.Get("message").MustString(`{{ template "default.message" . }}`)

	return &DiscordNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   model.UID,
			Name:                  model.Name,
			Type:                  model.Type,
			DisableResolveMessage: model.DisableResolveMessage,
			Settings:              model.Settings,
			SecureSettings:        model.SecureSettings,
		}),
		Content:            content,
		AvatarURL:          avatarURL,
		WebhookURL:         discordURL,
		log:                log.New("alerting.notifier.discord"),
		tmpl:               t,
		UseDiscordUsername: useDiscordUsername,
	}, nil
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
		"text":     "Grafana v" + setting.BuildVersion,
		"icon_url": "https://grafana.com/assets/img/fav32.png",
	}

	embed := simplejson.New()
	embed.Set("title", tmpl(`{{ template "default.title" . }}`))
	embed.Set("footer", footer)
	embed.Set("type", "rich")

	color, _ := strconv.ParseInt(strings.TrimLeft(getAlertStatusColor(alerts.Status()), "#"), 16, 0)
	embed.Set("color", color)

	ruleURL := joinUrlPath(d.tmpl.ExternalURL.String(), "/alerting/list", d.log)
	embed.Set("url", ruleURL)

	bodyJSON.Set("embeds", []interface{}{embed})

	u := tmpl(d.WebhookURL)
	if tmplErr != nil {
		d.log.Debug("failed to template Discord message", "err", tmplErr.Error())
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

	if err := bus.DispatchCtx(ctx, cmd); err != nil {
		d.log.Error("Failed to send notification to Discord", "error", err)
		return false, err
	}
	return true, nil
}

func (d DiscordNotifier) SendResolved() bool {
	return !d.GetDisableResolveMessage()
}
