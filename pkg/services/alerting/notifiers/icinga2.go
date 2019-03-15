package notifiers

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m  "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "icinga2",
		Name:        "Icinga2",
		Description: "Sends notifications to Icinga2 via Icinga2 API",
		Factory:     NewIcinga2Notifier,
		OptionsTemplate: `
      <h3 class="page-heading">Icinga2 settings</h3>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Url</span>
        <input type="text" required class="gf-form-input max-width-30" ng-model="ctrl.model.settings.url" placeholder="Icinga2 API url"></input>
      </div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Recipient</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.recipient"
          data-placement="right">
        </input>
        <info-popover mode="right-absolute">
          Override default channel or user, use #channel-name or @username
        </info-popover>
      </div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Username</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.username"
          data-placement="right">
        </input>
        <info-popover mode="right-absolute">
          Set the username for the bot's message
        </info-popover>
      </div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Icon emoji</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.icon_emoji"
          data-placement="right">
        </input>
        <info-popover mode="right-absolute">
          Provide an emoji to use as the icon for the bot's message. Overrides the icon URL
        </info-popover>
      </div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Icon URL</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.icon_url"
          data-placement="right">
        </input>
        <info-popover mode="right-absolute">
          Provide a URL to an image to use as the icon for the bot's message
        </info-popover>
      </div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Mention</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.mention"
          data-placement="right">
        </input>
        <info-popover mode="right-absolute">
          Mention a user or a group using @ when notifying in a channel
        </info-popover>
      </div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Token</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.token"
          data-placement="right">
        </input>
        <info-popover mode="right-absolute">
          Provide a bot token to use the Slack file.upload API (starts with "xoxb"). Specify #channel-name or @username in Recipient for this to work
        </info-popover>
      </div>
    `,
	})

}

func NewIcinga2Notifier(model *m.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	recipient := model.Settings.Get("serviceName").MustString()
	token := model.Settings.Get("token").MustString()

	return &Icinga2Notifier{
		NotifierBase: NewNotifierBase(model),
		Url:          url,
		ServiceName:  serviceName,
		Token:        token,
		log:          log.New("alerting.notifier.icinga2"),
	}, nil
}

type Icinga2Notifier struct {
	NotifierBase
	Url       string
	ServiceName string
	Token     string
	log       log.Logger
}

func (this *Icinga2Notifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Executing icinga2 notification", "ruleId", evalContext.Rule.Id, "notification", this.Name)

	ruleUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed get rule link", "error", err)
		return err
	}

	fields := make([]map[string]interface{}, 0)
	fieldLimitCount := 4
	for index, evt := range evalContext.EvalMatches {
		fields = append(fields, map[string]interface{}{
			"title": evt.Metric,
			"value": evt.Value,
			"short": true,
		})
		if index > fieldLimitCount {
			break
		}
	}

	if evalContext.Error != nil {
		fields = append(fields, map[string]interface{}{
			"title": "Error message",
			"value": evalContext.Error.Error(),
			"short": false,
		})
	}

	message := this.Mention
	if evalContext.Rule.State != m.AlertStateOK { //don't add message when going back to alert state ok.
		message += " " + evalContext.Rule.Message
	}
	image_url := ""
	// default to file.upload API method if a token is provided
	if this.Token == "" {
		image_url = evalContext.ImagePublicUrl
	}

	body := map[string]interface{}{
		"attachments": []map[string]interface{}{
			{
				"fallback":    evalContext.GetNotificationTitle(),
				"color":       evalContext.GetStateModel().Color,
				"title":       evalContext.GetNotificationTitle(),
				"title_link":  ruleUrl,
				"text":        message,
				"fields":      fields,
				"image_url":   image_url,
				"footer":      "Grafana v" + setting.BuildVersion,
				"footer_icon": "https://grafana.com/assets/img/fav32.png",
				"ts":          time.Now().Unix(),
			},
		},
		"parse": "full", // to linkify urls, users and channels in alert message.
	}

	//recipient override
	if this.Recipient != "" {
		body["channel"] = this.Recipient
	}
	if this.Username != "" {
		body["username"] = this.Username
	}
	if this.IconEmoji != "" {
		body["icon_emoji"] = this.IconEmoji
	}
	if this.IconUrl != "" {
		body["icon_url"] = this.IconUrl
	}
	data, _ := json.Marshal(&body)
	cmd := &m.SendWebhookSync{Url: this.Url, Body: string(data)}
	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send icinga2 notification", "error", err, "webhook", this.Name)
		return err
	}
	return nil
}

func GenerateIcinga2Body(file string, token string, recipient string) (map[string]string, bytes.Buffer, error) {

	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	// Add the generated image file
	f, err := os.Open(file)
	if err != nil {
		return nil, b, err
	}
	defer f.Close()
	fw, err := w.CreateFormFile("file", file)
	if err != nil {
		return nil, b, err
	}
	_, err = io.Copy(fw, f)
	if err != nil {
		return nil, b, err
	}
	// Add the authorization token
	err = w.WriteField("token", token)
	if err != nil {
		return nil, b, err
	}
	// Add the channel(s) to POST to
	err = w.WriteField("channels", recipient)
	if err != nil {
		return nil, b, err
	}
	w.Close()
	headers := map[string]string{
		"Content-Type":  w.FormDataContentType(),
		"Authorization": "auth_token=\"" + token + "\"",
	}
	return headers, b, nil
}
