package notifiers

import (
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

const weComMsgTypeNews = "news"
const weComMsgTypeMarkdown = "markdown"

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "wecom",
		Name:        "WeCom",
		Description: "Sends HTTP POST request to WeCom",
		Heading:     "WeCom settings",
		Factory:     NewWeComNotifier,
		Options: []alerting.NotifierOption{
			{
				Label:        "Url",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxx",
				PropertyName: "url",
				Required:     true,
			},
			{
				Label:        "Message type",
				Element:      alerting.ElementTypeSelect,
				PropertyName: "msgType",
				SelectOptions: []alerting.SelectOption{
					{
						Value: weComMsgTypeMarkdown,
						Label: "Markdown",
					},
					{
						Value: weComMsgTypeNews,
						Label: "News",
					},
				},
			},
			{
				Label:        "Send image as single message",
				Element:      alerting.ElementTypeCheckbox,
				InputType:    alerting.ElementTypeCheckbox,
				Description:  "Send included image as individual message for a clearer reading",
				PropertyName: "uploadSingleImage",
			},
		},
	})
}

// NewWeComNotifier is the constructor for WeCom notifier.
func NewWeComNotifier(model *models.AlertNotification, _ alerting.GetDecryptedValueFn) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	msgType := model.Settings.Get("msgType").MustString(weComMsgTypeMarkdown)
	uploadSingleImage := model.Settings.Get("uploadSingleImage").MustBool()

	return &WeComNotifier{
		NotifierBase:      NewNotifierBase(model),
		MsgType:           msgType,
		URL:               url,
		UploadSingleImage: uploadSingleImage,
		log:               log.New("alerting.notifier.wecom"),
	}, nil
}

// WeComNotifier is responsible for sending alert notifications to WeCom.
type WeComNotifier struct {
	NotifierBase
	MsgType           string
	URL               string
	UploadSingleImage bool
	log               log.Logger
}

// Notify send an alert notification to WeCom.
func (w *WeComNotifier) Notify(evalContext *alerting.EvalContext) error {
	w.log.Info("Sending WeCom")

	body, err := w.buildBody(evalContext)
	if err != nil {
		return err
	}

	cmd := &models.SendWebhookSync{
		Url:  w.URL,
		Body: string(body),
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		w.log.Error("Failed to send WeCom", "error", err, "wecom", w.Name)
		return err
	}

	if w.UploadSingleImage && w.NeedsImage() {
		if err := w.uploadImage(evalContext); err != nil {
			w.log.Error("Failed to send WeCom image", "error", err)
		}
	}

	return nil
}

func (w *WeComNotifier) uploadImage(evalContext *alerting.EvalContext) error {
	if _, err := os.Stat(evalContext.ImageOnDiskPath); err != nil {
		return nil
	}

	imgFile, err := os.Open(evalContext.ImageOnDiskPath)
	if err != nil {
		return err
	}
	defer func() {
		_ = imgFile.Close()
	}()

	f, err := ioutil.ReadAll(imgFile)
	if err != nil {
		return err
	}

	imgBody := map[string]interface{}{
		"msgtype": "image",
		"image": map[string]string{
			"base64": base64.StdEncoding.EncodeToString(f),
			"md5":    fmt.Sprintf("%x", md5.Sum(f)),
		},
	}

	imgBodyJSON, err := json.Marshal(imgBody)
	if err != nil {
		return err
	}

	imgCmd := &models.SendWebhookSync{
		Url:  w.URL,
		Body: string(imgBodyJSON),
	}

	if err := bus.DispatchCtx(evalContext.Ctx, imgCmd); err != nil {
		return err
	}

	return nil
}

func (w *WeComNotifier) truncate(str string, length int) string {
	if len(str) <= length {
		return str
	}
	return str[:length-1] + "..."
}

func (w *WeComNotifier) buildNewsBody(evalContext *alerting.EvalContext) ([]byte, error) {
	body := map[string]interface{}{
		"msgtype": w.MsgType,
	}
	messageURL, _ := evalContext.GetRuleURL()
	body["news"] = map[string]interface{}{
		"articles": []map[string]interface{}{
			{
				"title":       evalContext.GetNotificationTitle(),
				"description": w.truncate(evalContext.Rule.Message, 512),
				"url":         messageURL,
				"picurl":      evalContext.ImagePublicURL,
			},
		},
	}
	return json.Marshal(body)
}

func (w *WeComNotifier) buildMarkdownBody(evalContext *alerting.EvalContext) ([]byte, error) {
	body := map[string]interface{}{
		"msgtype": w.MsgType,
	}
	content := fmt.Sprintf("# %v\nState: %s\n",
		evalContext.GetNotificationTitle(),
		evalContext.Rule.State,
	)

	if evalContext.Rule.Message != "" {
		content += fmt.Sprintf("Message: %s%v%s\n",
			"<font color=\"warning\">",
			w.truncate(evalContext.Rule.Message, 500),
			"</font>",
		)
	}

	messageURL, _ := evalContext.GetRuleURL()
	content += fmt.Sprintf("URL: [%s](%s)\n", messageURL, messageURL)
	if w.NeedsImage() && evalContext.ImagePublicURL != "" {
		content += fmt.Sprintf("Image: [%s](%s)\n",
			evalContext.ImagePublicURL, evalContext.ImagePublicURL)
	}

	for index, match := range evalContext.EvalMatches {
		if index == 0 {
			content += "> Metrics:\n"
		}

		if index > 4 {
			content += fmt.Sprintf("> [More](%s)\n", messageURL)
			break
		}

		content += fmt.Sprintf("> %d. <font color=\"comment\">%s</font> = `%s`\n",
			index+1, w.truncate(match.Metric, 500), match.Value)
	}

	body["markdown"] = map[string]interface{}{
		"content": content,
	}
	return json.Marshal(body)
}

func (w *WeComNotifier) buildBody(evalContext *alerting.EvalContext) ([]byte, error) {
	switch w.MsgType {
	case weComMsgTypeNews:
		return w.buildNewsBody(evalContext)
	default:
		return w.buildMarkdownBody(evalContext)
	}
}
