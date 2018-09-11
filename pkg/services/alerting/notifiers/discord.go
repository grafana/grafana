package notifiers

import (
	"bytes"
	"io"
	"mime/multipart"
	"os"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
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
		NotifierBase: NewNotifierBase(model),
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
			"value":  evt.Value.FullString(),
			"inline": true,
		})
	}

	footer := map[string]interface{}{
		"text":     "Grafana v" + setting.BuildVersion,
		"icon_url": "https://grafana.com/assets/img/fav32.png",
	}

	color, _ := strconv.ParseInt(strings.TrimLeft(evalContext.GetStateModel().Color, "#"), 16, 0)

	embed := simplejson.New()
	embed.Set("title", evalContext.GetNotificationTitle())
	//Discord takes integer for color
	embed.Set("color", color)
	embed.Set("url", ruleUrl)
	embed.Set("description", evalContext.Rule.Message)
	embed.Set("type", "rich")
	embed.Set("fields", fields)
	embed.Set("footer", footer)

	var image map[string]interface{}
	var embeddedImage = false

	if evalContext.ImagePublicUrl != "" {
		image = map[string]interface{}{
			"url": evalContext.ImagePublicUrl,
		}
		embed.Set("image", image)
	} else {
		image = map[string]interface{}{
			"url": "attachment://graph.png",
		}
		embed.Set("image", image)
		embeddedImage = true
	}

	bodyJSON.Set("embeds", []interface{}{embed})

	json, _ := bodyJSON.MarshalJSON()

	content_type := "application/json"

	var body []byte

	if embeddedImage {

		var b bytes.Buffer

		w := multipart.NewWriter(&b)

		f, err := os.Open(evalContext.ImageOnDiskPath)

		if err != nil {
			this.log.Error("Can't open graph file", err)
			return err
		}

		defer f.Close()

		fw, err := w.CreateFormField("payload_json")
		if err != nil {
			return err
		}

		if _, err = fw.Write([]byte(string(json))); err != nil {
			return err
		}

		fw, err = w.CreateFormFile("file", "graph.png")
		if err != nil {
			return err
		}

		if _, err = io.Copy(fw, f); err != nil {
			return err
		}

		w.Close()

		body = b.Bytes()
		content_type = w.FormDataContentType()

	} else {
		body = json
	}

	cmd := &m.SendWebhookSync{
		Url:         this.WebhookURL,
		Body:        string(body),
		HttpMethod:  "POST",
		ContentType: content_type,
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send notification to Discord", "error", err)
		return err
	}

	return nil
}
