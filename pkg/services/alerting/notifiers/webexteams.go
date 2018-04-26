package notifiers

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/textproto"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "webexteams",
		Name:        "Webex Teams",
		Description: "Sends notifications to Webex Teams",
		Factory:     NewWebexTeamsNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">Webex Teams settings</h3>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Room ID</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.roomId"
          data-placement="right">
        </input>
        <info-popover mode="right-absolute">
		  Webex Teams room identifier
        </info-popover>
      </div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">API Token</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.token"
          data-placement="right">
        </input>
        <info-popover mode="right-absolute">
          API token to post to the Webex Teams room
        </info-popover>
      </div>
    `,
	})

}

func NewWebexTeamsNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	url := "https://api.ciscospark.com/v1/messages"

	roomId := model.Settings.Get("roomId").MustString()
	token := model.Settings.Get("token").MustString()
	uploadImage := model.Settings.Get("uploadImage").MustBool(true)

	if roomId == "" {
		return nil, alerting.ValidationError{Reason: "Room ID must be provided"}
	}
	if token == "" {
		return nil, alerting.ValidationError{Reason: "API token must be provided"}
	}

	return &WebexTeamsNotifier{
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		Url:          url,
		Recipient:    roomId,
		Token:        token,
		Upload:       uploadImage,
		log:          log.New("alerting.notifier.webexteams"),
	}, nil
}

type WebexTeamsNotifier struct {
	NotifierBase
	Url       string
	Recipient string
	Token     string
	Upload    bool
	log       log.Logger
}

func (this *WebexTeamsNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Executing webexteams notification", "ruleId", evalContext.Rule.Id, "notification", this.Name)

	ruleUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed get rule link", "error", err, "notification", this.Name)
		return err
	}

	// Select description and emoji based on state
	prefix := ""
	if evalContext.Rule.State == m.AlertStateOK {
		prefix = "\u2705 "
	} else if evalContext.Rule.State == m.AlertStateNoData {
		prefix = "\U0001f535 "
	} else if evalContext.Rule.State != m.AlertStateOK {
		prefix = "\U0001f6d1 "
	}

	description := ""
	if evalContext.Rule.State != m.AlertStateOK { // Don't add message when going back to alert state ok.
		description = ": " + evalContext.Rule.Message
	}

	// Format alert message
	messageFormat := "\n%s**[%s](%s) [%s]**%s\n"
	message := fmt.Sprintf(messageFormat, prefix, evalContext.Rule.Name, ruleUrl, evalContext.Rule.State, description)
	for _, evt := range evalContext.EvalMatches {
		message += fmt.Sprintf("- **%s**: %s\n", evt.Metric, evt.Value)
	}
	if evalContext.Error != nil {
		message += fmt.Sprintf("- **Error**: %s\n", evalContext.Error.Error())
	}
	this.log.Info("Sending notification to webexteams", "message", message, "evalContext.ImageOnDiskPath", evalContext.ImageOnDiskPath, "notification", this.Name)

	if evalContext.ImageOnDiskPath == "" {
		evalContext.ImageOnDiskPath = filepath.Join(setting.HomePath, "public/img/mixed_styles.png")
	}

	// Send alert using webhooks
	headers, uploadBody, err := GenerateWebexTeamsBody(evalContext.ImageOnDiskPath, this.Token, this.Recipient, message)
	if err != nil {
		return err
	}
	cmd := &m.SendWebhookSync{Url: this.Url, Body: uploadBody.String(), HttpHeader: headers, HttpMethod: "POST"}
	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send notification to webexteams", "error", err, "notification", this.Name)
		return err
	}
	if err != nil {
		return err
	}
	return nil
}

// GenerateWebexTeamsBody prepares a multi-part body to post to Webex Teams.
func GenerateWebexTeamsBody(file string, token string, roomId string, message string) (map[string]string, bytes.Buffer, error) {
	// See https://developer.webex.com/attachments.html
	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	// Add the room ID
	err := w.WriteField("roomId", roomId)
	if err != nil {
		return nil, b, err
	}
	// Add the message
	err = w.WriteField("markdown", message)
	if err != nil {
		return nil, b, err
	}
	// Add the generated image file
	f, err := os.Open(file)
	if err != nil {
		return nil, b, err
	}
	defer f.Close()
	// CreateFormFile does not allow us to set the content-type, which is
	// mandatory to get the image to preview in Webex Teams.
	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, "files", file))
	h.Set("Content-Type", "image/png")
	fw, err := w.CreatePart(h)
	if err != nil {
		return nil, b, err
	}
	_, err = io.Copy(fw, f)
	if err != nil {
		return nil, b, err
	}
	w.Close()
	headers := map[string]string{
		"Content-Type":  w.FormDataContentType(),
		"Authorization": "Bearer " + token,
	}
	return headers, b, nil
}
