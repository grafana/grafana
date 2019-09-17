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
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "slack",
		Name:        "Slack",
		Description: "Sends notifications to Slack via Slack Webhooks",
		Factory:     NewSlackNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">Slack settings</h3>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Url</span>
        <input type="text" required class="gf-form-input max-width-30" ng-model="ctrl.model.settings.url" placeholder="Slack incoming webhook url"></input>
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

// NewSlackNotifier is the constructor for the Slack notifier
func NewSlackNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	recipient := model.Settings.Get("recipient").MustString()
	username := model.Settings.Get("username").MustString()
	iconEmoji := model.Settings.Get("icon_emoji").MustString()
	iconURL := model.Settings.Get("icon_url").MustString()
	mention := model.Settings.Get("mention").MustString()
	token := model.Settings.Get("token").MustString()
	uploadImage := model.Settings.Get("uploadImage").MustBool(true)

	return &SlackNotifier{
		NotifierBase: NewNotifierBase(model),
		URL:          url,
		Recipient:    recipient,
		Username:     username,
		IconEmoji:    iconEmoji,
		IconURL:      iconURL,
		Mention:      mention,
		Token:        token,
		Upload:       uploadImage,
		log:          log.New("alerting.notifier.slack"),
	}, nil
}

// SlackNotifier is responsible for sending
// alert notification to Slack.
type SlackNotifier struct {
	NotifierBase
	URL       string
	Recipient string
	Username  string
	IconEmoji string
	IconURL   string
	Mention   string
	Token     string
	Upload    bool
	log       log.Logger
}

// Notify send alert notification to Slack.
func (sn *SlackNotifier) Notify(evalContext *alerting.EvalContext) error {
	sn.log.Info("Executing slack notification", "ruleId", evalContext.Rule.ID, "notification", sn.Name)

	ruleURL, err := evalContext.GetRuleURL()
	if err != nil {
		sn.log.Error("Failed get rule link", "error", err)
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

	message := sn.Mention
	if evalContext.Rule.State != models.AlertStateOK { //don't add message when going back to alert state ok.
		message += " " + evalContext.Rule.Message
	}
	imageURL := ""
	// default to file.upload API method if a token is provided
	if sn.Token == "" {
		imageURL = evalContext.ImagePublicURL
	}

	body := map[string]interface{}{
		"attachments": []map[string]interface{}{
			{
				"fallback":    evalContext.GetNotificationTitle(),
				"color":       evalContext.GetStateModel().Color,
				"title":       evalContext.GetNotificationTitle(),
				"title_link":  ruleURL,
				"text":        message,
				"fields":      fields,
				"image_url":   imageURL,
				"footer":      "Grafana v" + setting.BuildVersion,
				"footer_icon": "https://grafana.com/assets/img/fav32.png",
				"ts":          time.Now().Unix(),
			},
		},
		"parse": "full", // to linkify urls, users and channels in alert message.
	}

	//recipient override
	if sn.Recipient != "" {
		body["channel"] = sn.Recipient
	}
	if sn.Username != "" {
		body["username"] = sn.Username
	}
	if sn.IconEmoji != "" {
		body["icon_emoji"] = sn.IconEmoji
	}
	if sn.IconURL != "" {
		body["icon_url"] = sn.IconURL
	}
	data, _ := json.Marshal(&body)
	cmd := &models.SendWebhookSync{Url: sn.URL, Body: string(data)}
	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		sn.log.Error("Failed to send slack notification", "error", err, "webhook", sn.Name)
		return err
	}
	if sn.Token != "" && sn.UploadImage {
		err = slackFileUpload(evalContext, sn.log, "https://slack.com/api/files.upload", sn.Recipient, sn.Token)
		if err != nil {
			return err
		}
	}
	return nil
}

func slackFileUpload(evalContext *alerting.EvalContext, log log.Logger, url string, recipient string, token string) error {
	if evalContext.ImageOnDiskPath == "" {
		evalContext.ImageOnDiskPath = filepath.Join(setting.HomePath, "public/img/mixed_styles.png")
	}
	log.Info("Uploading to slack via file.upload API")
	headers, uploadBody, err := generateSlackBody(evalContext.ImageOnDiskPath, token, recipient)
	if err != nil {
		return err
	}
	cmd := &models.SendWebhookSync{Url: url, Body: uploadBody.String(), HttpHeader: headers, HttpMethod: "POST"}
	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		log.Error("Failed to upload slack image", "error", err, "webhook", "file.upload")
		return err
	}
	return nil
}

func generateSlackBody(file string, token string, recipient string) (map[string]string, bytes.Buffer, error) {
	// Slack requires all POSTs to files.upload to present
	// an "application/x-www-form-urlencoded" encoded querystring
	// See https://api.slack.com/methods/files.upload
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
