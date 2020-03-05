package notifiers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"regexp"
	"strings"
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
        <span class="gf-form-label width-8">Url</span>
        <input type="text" required class="gf-form-input max-width-30" ng-model="ctrl.model.settings.url" placeholder="Slack incoming webhook url"></input>
      </div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-8">Recipient</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.recipient"
          data-placement="right">
        </input>
        <info-popover mode="right-absolute">
          Override default channel or user, use #channel-name, @username (has to be all lowercase, no whitespace), or user/channel Slack ID
        </info-popover>
      </div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-8">Username</span>
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
        <span class="gf-form-label width-8">Icon emoji</span>
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
        <span class="gf-form-label width-8">Icon URL</span>
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
        <span class="gf-form-label width-8">Mention Users</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.mentionUsers"
          data-placement="right">
        </input>
        <info-popover mode="right-absolute">
          Mention one or more users (comma separated) when notifying in a channel, by ID (you can copy this from the user's Slack profile)
        </info-popover>
      </div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-8">Mention Groups</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.mentionGroups"
          data-placement="right">
        </input>
        <info-popover mode="right-absolute">
          Mention one or more groups (comma separated) when notifying in a channel (you can copy this from the group's Slack profile URL)
        </info-popover>
      </div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-8">Mention Channel</span>
        <select
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.mentionChannel"
          data-placement="right">
		  <option value="">Disabled</option>
		  <option value="here">Every active channel member</option>
		  <option value="channel">Every channel member</option>
        </select>
        <info-popover mode="right-absolute">
          Mention whole channel or just active members when notifying
        </info-popover>
      </div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-8">Token</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.token"
          data-placement="right">
        </input>
        <info-popover mode="right-absolute">
          Provide a bot token to use the Slack file.upload API (starts with "xoxb"). Specify Recipient for this to work
        </info-popover>
      </div>
    `,
	})
}

var reRecipient *regexp.Regexp = regexp.MustCompile("^((@[a-z0-9][a-zA-Z0-9._-]*)|(#[^ .A-Z]{1,79})|([a-zA-Z0-9]+))$")

// NewSlackNotifier is the constructor for the Slack notifier
func NewSlackNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	recipient := strings.TrimSpace(model.Settings.Get("recipient").MustString())
	if recipient != "" && !reRecipient.MatchString(recipient) {
		return nil, alerting.ValidationError{Reason: fmt.Sprintf("Recipient on invalid format: %q", recipient)}
	}
	username := model.Settings.Get("username").MustString()
	iconEmoji := model.Settings.Get("icon_emoji").MustString()
	iconURL := model.Settings.Get("icon_url").MustString()
	mentionUsersStr := model.Settings.Get("mentionUsers").MustString()
	mentionGroupsStr := model.Settings.Get("mentionGroups").MustString()
	mentionChannel := model.Settings.Get("mentionChannel").MustString()
	token := model.Settings.Get("token").MustString()
	uploadImage := model.Settings.Get("uploadImage").MustBool(true)

	if mentionChannel != "" && mentionChannel != "here" && mentionChannel != "channel" {
		return nil, alerting.ValidationError{
			Reason: fmt.Sprintf("Invalid value for mentionChannel: %q", mentionChannel),
		}
	}
	mentionUsers := []string{}
	for _, u := range strings.Split(mentionUsersStr, ",") {
		u = strings.TrimSpace(u)
		if u != "" {
			mentionUsers = append(mentionUsers, u)
		}
	}
	mentionGroups := []string{}
	for _, g := range strings.Split(mentionGroupsStr, ",") {
		g = strings.TrimSpace(g)
		if g != "" {
			mentionGroups = append(mentionGroups, g)
		}
	}

	return &SlackNotifier{
		NotifierBase:   NewNotifierBase(model),
		URL:            url,
		Recipient:      recipient,
		Username:       username,
		IconEmoji:      iconEmoji,
		IconURL:        iconURL,
		MentionUsers:   mentionUsers,
		MentionGroups:  mentionGroups,
		MentionChannel: mentionChannel,
		Token:          token,
		Upload:         uploadImage,
		log:            log.New("alerting.notifier.slack"),
	}, nil
}

// SlackNotifier is responsible for sending
// alert notification to Slack.
type SlackNotifier struct {
	NotifierBase
	URL            string
	Recipient      string
	Username       string
	IconEmoji      string
	IconURL        string
	MentionUsers   []string
	MentionGroups  []string
	MentionChannel string
	Token          string
	Upload         bool
	log            log.Logger
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

	mentionsBuilder := strings.Builder{}
	appendSpace := func() {
		if mentionsBuilder.Len() > 0 {
			mentionsBuilder.WriteString(" ")
		}
	}
	mentionChannel := strings.TrimSpace(sn.MentionChannel)
	if mentionChannel != "" {
		mentionsBuilder.WriteString(fmt.Sprintf("<!%s|%s>", mentionChannel, mentionChannel))
	}
	if len(sn.MentionGroups) > 0 {
		appendSpace()
		for _, g := range sn.MentionGroups {
			mentionsBuilder.WriteString(fmt.Sprintf("<!subteam^%s>", g))
		}
	}
	if len(sn.MentionUsers) > 0 {
		appendSpace()
		for _, u := range sn.MentionUsers {
			mentionsBuilder.WriteString(fmt.Sprintf("<@%s>", u))
		}
	}
	msg := ""
	if evalContext.Rule.State != models.AlertStateOK { //don't add message when going back to alert state ok.
		msg = evalContext.Rule.Message
	}
	imageURL := ""
	// default to file.upload API method if a token is provided
	if sn.Token == "" {
		imageURL = evalContext.ImagePublicURL
	}

	var blocks []map[string]interface{}
	if mentionsBuilder.Len() > 0 {
		blocks = []map[string]interface{}{
			{
				"type": "section",
				"text": map[string]interface{}{
					"type": "mrkdwn",
					"text": mentionsBuilder.String(),
				},
			},
		}
	}
	attachment := map[string]interface{}{
		"color":       evalContext.GetStateModel().Color,
		"title":       evalContext.GetNotificationTitle(),
		"title_link":  ruleURL,
		"text":        msg,
		"fallback":    evalContext.GetNotificationTitle(),
		"fields":      fields,
		"footer":      "Grafana v" + setting.BuildVersion,
		"footer_icon": "https://grafana.com/assets/img/fav32.png",
		"ts":          time.Now().Unix(),
	}
	if imageURL != "" {
		attachment["image_url"] = imageURL
	}
	body := map[string]interface{}{
		"text":   evalContext.GetNotificationTitle(),
		"blocks": blocks,
		"attachments": []map[string]interface{}{
			attachment,
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
	data, err := json.Marshal(&body)
	if err != nil {
		return err
	}

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
