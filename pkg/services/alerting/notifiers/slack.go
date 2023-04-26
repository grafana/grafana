package notifiers

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "slack",
		Name:        "Slack",
		Description: "Sends notifications to Slack",
		Heading:     "Slack settings",
		Factory:     NewSlackNotifier,
		Options: []alerting.NotifierOption{
			{
				Label:        "Recipient",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "Specify channel, private group, or IM channel (can be an encoded ID or a name) - required unless you provide a webhook",
				PropertyName: "recipient",
			},
			// Logically, this field should be required when not using a webhook, since the Slack API needs a token.
			// However, since the UI doesn't allow to say that a field is required or not depending on another field,
			// we've gone with the compromise of making this field optional and instead return a validation error
			// if it's necessary and missing.
			{
				Label:        "Token",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "Provide a Slack API token (starts with \"xoxb\") - required unless you provide a webhook",
				PropertyName: "token",
				Secure:       true,
			},
			{
				Label:        "Username",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "Set the username for the bot's message",
				PropertyName: "username",
			},
			{
				Label:        "Icon emoji",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "Provide an emoji to use as the icon for the bot's message. Overrides the icon URL.",
				PropertyName: "icon_emoji",
			},
			{
				Label:        "Icon URL",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "Provide a URL to an image to use as the icon for the bot's message",
				PropertyName: "icon_url",
			},
			{
				Label:        "Mention Users",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "Mention one or more users (comma separated) when notifying in a channel, by ID (you can copy this from the user's Slack profile)",
				PropertyName: "mentionUsers",
			},
			{
				Label:        "Mention Groups",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "Mention one or more groups (comma separated) when notifying in a channel (you can copy this from the group's Slack profile URL)",
				PropertyName: "mentionGroups",
			},
			{
				Label:   "Mention Channel",
				Element: alerting.ElementTypeSelect,
				SelectOptions: []alerting.SelectOption{
					{
						Value: "",
						Label: "Disabled",
					},
					{
						Value: "here",
						Label: "Every active channel member",
					},
					{
						Value: "channel",
						Label: "Every channel member",
					},
				},
				Description:  "Mention whole channel or just active members when notifying",
				PropertyName: "mentionChannel",
			},
			{
				Label:        "Webhook URL",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "Optionally provide a Slack incoming webhook URL for sending messages, in this case the token isn't necessary",
				Placeholder:  "Slack incoming webhook URL",
				PropertyName: "url",
				Secure:       true,
			},
		},
	})
}

const slackAPIEndpoint = "https://slack.com/api/chat.postMessage"

// NewSlackNotifier is the constructor for the Slack notifier.
func NewSlackNotifier(model *models.AlertNotification, fn alerting.GetDecryptedValueFn, ns notifications.Service) (alerting.Notifier, error) {
	urlStr := fn(context.Background(), model.SecureSettings, "url", model.Settings.Get("url").MustString(), setting.SecretKey)
	if urlStr == "" {
		urlStr = slackAPIEndpoint
	}
	apiURL, err := url.Parse(urlStr)
	if err != nil {
		return nil, fmt.Errorf("invalid URL %q: %w", urlStr, err)
	}

	recipient := strings.TrimSpace(model.Settings.Get("recipient").MustString())
	if recipient == "" && apiURL.String() == slackAPIEndpoint {
		return nil, alerting.ValidationError{
			Reason: "recipient must be specified when using the Slack chat API",
		}
	}
	username := model.Settings.Get("username").MustString()
	iconEmoji := model.Settings.Get("icon_emoji").MustString()
	iconURL := model.Settings.Get("icon_url").MustString()
	mentionUsersStr := model.Settings.Get("mentionUsers").MustString()
	mentionGroupsStr := model.Settings.Get("mentionGroups").MustString()
	mentionChannel := model.Settings.Get("mentionChannel").MustString()
	token := fn(context.Background(), model.SecureSettings, "token", model.Settings.Get("token").MustString(), setting.SecretKey)
	if token == "" && apiURL.String() == slackAPIEndpoint {
		return nil, alerting.ValidationError{
			Reason: "token must be specified when using the Slack chat API",
		}
	}

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
		url:            apiURL,
		NotifierBase:   NewNotifierBase(model, ns),
		recipient:      recipient,
		username:       username,
		iconEmoji:      iconEmoji,
		iconURL:        iconURL,
		mentionUsers:   mentionUsers,
		mentionGroups:  mentionGroups,
		mentionChannel: mentionChannel,
		token:          token,
		upload:         uploadImage,
		log:            log.New("alerting.notifier.slack"),
	}, nil
}

// SlackNotifier is responsible for sending
// alert notification to Slack.
type SlackNotifier struct {
	NotifierBase
	url            *url.URL
	recipient      string
	username       string
	iconEmoji      string
	iconURL        string
	mentionUsers   []string
	mentionGroups  []string
	mentionChannel string
	token          string
	upload         bool
	log            log.Logger
}

// Notify sends an alert notification to Slack.
func (sn *SlackNotifier) Notify(evalContext *alerting.EvalContext) error {
	sn.log.Info("Executing slack notification", "ruleId", evalContext.Rule.ID, "notification", sn.Name)

	ruleURL, err := evalContext.GetRuleURL()
	if err != nil {
		sn.log.Error("Failed to get rule link", "error", err)
		return err
	}

	fields := make([]map[string]interface{}, 0)
	for _, evt := range evalContext.EvalMatches {
		fields = append(fields, map[string]interface{}{
			"title": evt.Metric,
			"value": evt.Value,
			"short": true,
		})
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
	mentionChannel := strings.TrimSpace(sn.mentionChannel)
	if mentionChannel != "" {
		mentionsBuilder.WriteString(fmt.Sprintf("<!%s|%s>", mentionChannel, mentionChannel))
	}
	if len(sn.mentionGroups) > 0 {
		appendSpace()
		for _, g := range sn.mentionGroups {
			mentionsBuilder.WriteString(fmt.Sprintf("<!subteam^%s>", g))
		}
	}
	if len(sn.mentionUsers) > 0 {
		appendSpace()
		for _, u := range sn.mentionUsers {
			mentionsBuilder.WriteString(fmt.Sprintf("<@%s>", u))
		}
	}
	msg := ""
	if evalContext.Rule.State != models.AlertStateOK { // don't add message when going back to alert state ok.
		msg = evalContext.Rule.Message
	}
	imageURL := ""
	// default to file.upload API method if a token is provided
	if sn.token == "" {
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
		"footer_icon": "https://grafana.com/static/assets/img/fav32.png",
		"ts":          time.Now().Unix(),
	}
	if sn.NeedsImage() && imageURL != "" {
		attachment["image_url"] = imageURL
	}
	body := map[string]interface{}{
		"channel": sn.recipient,
		"attachments": []map[string]interface{}{
			attachment,
		},
	}
	if len(blocks) > 0 {
		body["blocks"] = blocks
	}

	if sn.username != "" {
		body["username"] = sn.username
	}
	if sn.iconEmoji != "" {
		body["icon_emoji"] = sn.iconEmoji
	}
	if sn.iconURL != "" {
		body["icon_url"] = sn.iconURL
	}
	data, err := json.Marshal(&body)
	if err != nil {
		return err
	}

	if err := sn.sendRequest(evalContext.Ctx, data); err != nil {
		return err
	}

	if sn.token != "" && sn.UploadImage {
		err := sn.slackFileUpload(evalContext, sn.log, sn.recipient, sn.token)
		if err != nil {
			return err
		}
	}

	return nil
}

func (sn *SlackNotifier) sendRequest(ctx context.Context, data []byte) error {
	sn.log.Debug("Sending Slack API request", "url", sn.url.String(), "data", string(data))
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, sn.url.String(), bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to create HTTP request: %w", err)
	}

	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("User-Agent", "Grafana")
	if sn.token == "" {
		if sn.url.String() == slackAPIEndpoint {
			panic("Token should be set when using the Slack chat API")
		}
	} else {
		sn.log.Debug("Adding authorization header to HTTP request")
		request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", sn.token))
	}

	netTransport := &http.Transport{
		TLSClientConfig: &tls.Config{
			Renegotiation: tls.RenegotiateFreelyAsClient,
		},
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout: 30 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout: 5 * time.Second,
	}
	netClient := &http.Client{
		Timeout:   time.Second * 30,
		Transport: netTransport,
	}
	resp, err := netClient.Do(request)
	if err != nil {
		return err
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			sn.log.Warn("Failed to close response body", "err", err)
		}
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		// Slack responds to some requests with a JSON document, that might contain an error.
		rslt := struct {
			Ok  bool   `json:"ok"`
			Err string `json:"error"`
		}{}

		// Marshaling can fail if Slack's response body is plain text (e.g. "ok").
		if err := json.Unmarshal(body, &rslt); err != nil && json.Valid(body) {
			sn.log.Error("Failed to unmarshal Slack API response", "url", sn.url.String(), "statusCode", resp.Status,
				"err", err)
			return fmt.Errorf("failed to unmarshal Slack API response with status code %d: %s", resp.StatusCode, err)
		}

		if !rslt.Ok && rslt.Err != "" {
			sn.log.Error("Sending Slack API request failed", "url", sn.url.String(), "statusCode", resp.Status,
				"err", rslt.Err)
			return fmt.Errorf("failed to make Slack API request: %s", rslt.Err)
		}

		sn.log.Debug("Sending Slack API request succeeded", "url", sn.url.String(), "statusCode", resp.Status)

		return nil
	}

	sn.log.Error("Slack API request failed", "url", sn.url.String(), "statusCode", resp.Status, "body", string(body))
	return fmt.Errorf("request to Slack API failed with status code %d", resp.StatusCode)
}

func (sn *SlackNotifier) slackFileUpload(evalContext *alerting.EvalContext, log log.Logger, recipient, token string) error {
	if evalContext.ImageOnDiskPath == "" {
		// nolint:gosec
		// We can ignore the gosec G304 warning on this one because `setting.HomePath` comes from Grafana's configuration file.
		evalContext.ImageOnDiskPath = filepath.Join(setting.HomePath, "public/img/mixed_styles.png")
	}
	log.Info("Uploading to slack via file.upload API")
	headers, uploadBody, err := sn.generateSlackBody(evalContext.ImageOnDiskPath, token, recipient)
	if err != nil {
		return err
	}
	cmd := &notifications.SendWebhookSync{
		Url: "https://slack.com/api/files.upload", Body: uploadBody.String(), HttpHeader: headers, HttpMethod: "POST",
	}
	if err := sn.NotificationService.SendWebhookSync(evalContext.Ctx, cmd); err != nil {
		log.Error("Failed to upload slack image", "error", err, "webhook", "file.upload")
		return err
	}
	return nil
}

func (sn *SlackNotifier) generateSlackBody(path string, token string, recipient string) (map[string]string, bytes.Buffer, error) {
	// Slack requires all POSTs to files.upload to present
	// an "application/x-www-form-urlencoded" encoded querystring
	// See https://api.slack.com/methods/files.upload
	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	defer func() {
		if err := w.Close(); err != nil {
			// Shouldn't matter since we already close w explicitly on the non-error path
			sn.log.Warn("Failed to close multipart writer", "err", err)
		}
	}()

	// Add the generated image file
	// We can ignore the gosec G304 warning on this one because `imagePath` comes
	// from the alert `evalContext` that generates the images. `evalContext` in turn derives the root of the file
	// path from configuration variables.
	// nolint:gosec
	f, err := os.Open(path)
	if err != nil {
		return nil, b, err
	}
	defer func() {
		if err := f.Close(); err != nil {
			sn.log.Warn("Failed to close file", "path", path, "err", err)
		}
	}()
	fw, err := w.CreateFormFile("file", path)
	if err != nil {
		return nil, b, err
	}
	if _, err := io.Copy(fw, f); err != nil {
		return nil, b, err
	}
	// Add the authorization token
	if err := w.WriteField("token", token); err != nil {
		return nil, b, err
	}
	// Add the channel(s) to POST to
	if err := w.WriteField("channels", recipient); err != nil {
		return nil, b, err
	}
	if err := w.Close(); err != nil {
		return nil, b, fmt.Errorf("failed to close multipart writer: %w", err)
	}
	headers := map[string]string{
		"Content-Type":  w.FormDataContentType(),
		"Authorization": "auth_token=\"" + token + "\"",
	}
	return headers, b, nil
}
