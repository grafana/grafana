package notifiers

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

var (
	telegeramApiUrl string = "https://api.telegram.org/bot%s/%s"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "telegram",
		Name:        "Telegram",
		Description: "Sends notifications to Telegram",
		Factory:     NewTelegramNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">Telegram API settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-9">BOT API Token</span>
        <input type="text" required
					class="gf-form-input"
					ng-model="ctrl.model.settings.bottoken"
					placeholder="Telegram BOT API Token"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-9">Chat ID</span>
        <input type="text" required
					class="gf-form-input"
					ng-model="ctrl.model.settings.chatid"
					data-placement="right">
        </input>
        <info-popover mode="right-absolute">
					Integer Telegram Chat Identifier
        </info-popover>
      </div>
    `,
	})

}

type TelegramNotifier struct {
	NotifierBase
	BotToken    string
	ChatID      string
	UploadImage bool
	log         log.Logger
}

func makeHTMLUrl(title string, url string) string {
	if strings.Contains(url, "http://localhost") {
		return fmt.Sprintf("%s: %s\n", title, url)
	} else {
		return fmt.Sprintf("<a href='%s'>%s</a>\n", url, title)
	}
}

func NewTelegramNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	if model.Settings == nil {
		return nil, alerting.ValidationError{Reason: "No Settings Supplied"}
	}

	botToken := model.Settings.Get("bottoken").MustString()
	chatId := model.Settings.Get("chatid").MustString()
	uploadImage := model.Settings.Get("uploadImage").MustBool()

	if botToken == "" {
		return nil, alerting.ValidationError{Reason: "Could not find Bot Token in settings"}
	}

	if chatId == "" {
		return nil, alerting.ValidationError{Reason: "Could not find Chat Id in settings"}
	}

	return &TelegramNotifier{
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		BotToken:     botToken,
		ChatID:       chatId,
		UploadImage:  uploadImage,
		log:          log.New("alerting.notifier.telegram"),
	}, nil
}

func (this *TelegramNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Sending alert notification to", "bot_token", this.BotToken)
	this.log.Info("Sending alert notification to", "chat_id", this.ChatID)
	metrics.M_Alerting_Notification_Sent_Telegram.Inc(1)

	_, err := os.Stat(evalContext.ImageOnDiskPath)
	if err == nil && evalContext.ImagePublicUrl == "" && this.UploadImage == true {
		url := fmt.Sprintf(telegeramApiUrl, this.BotToken, "sendPhoto")
		caption := fmt.Sprintf("%s\nMessage: %s\n", evalContext.GetNotificationTitle(), evalContext.Rule.Message)

		ruleUrl, err := evalContext.GetRuleUrl()
		if err == nil {
			caption = caption + fmt.Sprintf("\nOpen in Grafana: %s", ruleUrl)
		}

		var b bytes.Buffer
		w := multipart.NewWriter(&b)
		f, err := os.Open(evalContext.ImageOnDiskPath)
		if err != nil {
			this.log.Error("Failed to read image file", "error", err, "telegram", this.Name)
		}
		defer f.Close()
		fw, err := w.CreateFormFile("photo", evalContext.ImageOnDiskPath)
		if err != nil {
			this.log.Error("Failed to read image file", "error", err, "telegram", this.Name)
		}
		io.Copy(fw, f)

		fw, _ = w.CreateFormField("chat_id")
		fw.Write([]byte(this.ChatID))

		fw, _ = w.CreateFormField("caption")
		fw.Write([]byte(caption))

		w.Close()

		req, _ := http.NewRequest("POST", url, &b)
		req.Header.Set("Content-Type", w.FormDataContentType())
		client := &http.Client{}
		res, err := client.Do(req)
		if err != nil {
			this.log.Error("Failed to send webhook", "error", err, "webhook", this.Name)
		}
		if res.StatusCode != http.StatusOK {
			this.log.Error("Failed to send webhook: bad status code in response", "error", res.StatusCode, "webhook", this.Name)
		}

	} else {

		bodyJSON := simplejson.New()

		bodyJSON.Set("chat_id", this.ChatID)
		bodyJSON.Set("parse_mode", "html")

		message := fmt.Sprintf("<b>%s</b>\nMessage: %s\n", evalContext.GetNotificationTitle(), evalContext.Rule.Message)

		if this.UploadImage == true && evalContext.ImagePublicUrl != "" {
			message = message + fmt.Sprintf("Graph: %s\n", evalContext.ImagePublicUrl)
		}

		ruleUrl, err := evalContext.GetRuleUrl()
		if err == nil {
			message = message + makeHTMLUrl("Open in Grafana", ruleUrl)
		}

		metrics := ""
		fieldLimitCount := 4
		for index, evt := range evalContext.EvalMatches {
			metrics += fmt.Sprintf("\n%s: %s", evt.Metric, evt.Value)
			if index > fieldLimitCount {
				break
			}
		}
		if metrics != "" {
			message = message + fmt.Sprintf("\n<i>Metrics:</i>%s", metrics)
		}

		bodyJSON.Set("text", message)

		url := fmt.Sprintf(telegeramApiUrl, this.BotToken, "sendMessage")
		body, _ := bodyJSON.MarshalJSON()

		cmd := &m.SendWebhookSync{
			Url:        url,
			Body:       string(body),
			HttpMethod: "POST",
		}

		if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
			this.log.Error("Failed to send webhook", "error", err, "webhook", this.Name)
			return err
		}
	}
	return nil
}
