package notifiers

import (
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "discord",
		Name:        "Discord",
		Description: "Sends notifications to Discord",
		Factory:     NewDiscordNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">Discord settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-14">Webhook URL</span>
        <input type="text" required class="gf-form-input max-width-22" ng-model="ctrl.model.settings.url" placeholder="Discord webhook URL"></input>
      </div>
    `,
	})
}

func NewDiscordNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find webhook url property in settings"}
	}

	return &DiscordNotifier{
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		WebhookURL:   url,
		log:          log.New("alerting.notifier.discord"),
	}, nil
}

type DiscordNotifier struct {
	NotifierBase
	WebhookURL string
	log        log.Logger
}

func (this *DiscordNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Sending alert notification to", "webhook_url", this.WebhookURL)
	metrics.M_Alerting_Notification_Sent_Discord.Inc(1)

	ruleUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed get rule link", "error", err)
		return err
	}

	bodyJSON := simplejson.New()
	bodyJSON.Set("username", "Grafana")

	fields := make([]map[string]interface{}, 0)

	for _, evt := range evalContext.EvalMatches {
		fields = append(fields, map[string]interface{}{
			"name":   evt.Metric,
			"value":  evt.Value,
			"inline": true,
		})
	}

	footer := map[string]interface{}{
		"text":     "Grafana v" + setting.BuildVersion,
		"icon_url": "https://grafana.com/assets/img/fav32.png",
	}

	color, _ := strconv.ParseInt(strings.TrimLeft(evalContext.GetStateModel().Color, "#"), 16, 0)

	image := map[string]interface{}{
		"url": evalContext.ImagePublicUrl,
	}

	embed := simplejson.New()
	embed.Set("title", evalContext.GetNotificationTitle())
	//Discord takes integer for color
	embed.Set("color", color)
	embed.Set("url", ruleUrl)
	embed.Set("description", evalContext.Rule.Message)
	embed.Set("type", "rich")
	embed.Set("fields", fields)
	embed.Set("footer", footer)
	embed.Set("image", image)

	bodyJSON.Set("embeds", []interface{}{embed})

	body, _ := bodyJSON.MarshalJSON()

	this.log.Info("Message", string(body))

	cmd := &m.SendWebhookSync{
		Url:        this.WebhookURL,
		Body:       string(body),
		HttpMethod: "POST",
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send notification to Discord", "error", err, "body", string(body))
		return err
	}

	return nil
}
