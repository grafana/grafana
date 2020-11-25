package notifiers

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

const defaultLarkMsgType = "text"
const larkNotifierDescription = `Use https://open.larksuite.com/open-apis/bot/v2/hook/xxxxxxxxx for larksuite.
Use https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxxx for feishu.`

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "lark",
		Name:        "Lark/Feishu",
		Description: "Sends HTTP POST request to Lark",
		Heading:     "Lark/Feishu settings",
		Factory:     newLarkNotifier,
		Options: []alerting.NotifierOption{
			{
				Label:        "Url",
				Description:  larkNotifierDescription,
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxxx",
				PropertyName: "url",
				Required:     true,
			},
			{
				Label:        "Message Type",
				Element:      alerting.ElementTypeSelect,
				PropertyName: "msgType",
				SelectOptions: []alerting.SelectOption{
					{
						Value: "text",
						Label: "Text",
					},
				},
			},
		},
	})
}

func newLarkNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	msgType := model.Settings.Get("msgType").MustString(defaultLarkMsgType)

	return &LarkNotifier{
		NotifierBase: NewNotifierBase(model),
		MsgType:      msgType,
		URL:          url,
		log:          log.New("alerting.notifier.lark"),
	}, nil
}

// LarkNotifier is responsible for sending alert notifications to ding ding.
type LarkNotifier struct {
	NotifierBase
	MsgType string
	URL     string
	log     log.Logger
}

// Notify sends the alert notification to lark.
func (lark *LarkNotifier) Notify(evalContext *alerting.EvalContext) error {
	lark.log.Info("Sending lark")

	messageURL, err := evalContext.GetRuleURL()
	if err != nil {
		lark.log.Error("Failed to get messageUrl", "error", err, "lark", lark.Name)
		messageURL = ""
	}

	body, err := lark.genBody(evalContext, messageURL)
	if err != nil {
		return err
	}
	lark.log.Debug("body: " + string(body))
	lark.log.Debug("url: " + lark.URL)

	cmd := &models.SendWebhookSync{
		Url:  lark.URL,
		Body: string(body),
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		lark.log.Error("Failed to send Lark", "error", err, "lark", lark.Name)
		return err
	}

	return nil
}

func (lark *LarkNotifier) genBody(evalContext *alerting.EvalContext, messageURL string) ([]byte, error) {
	lark.log.Info("messageUrl:" + messageURL)

	message := evalContext.Rule.Message
	title := evalContext.GetNotificationTitle()
	lark.log.Info("message: " + message)
	lark.log.Info("title: " + title)
	if message == "" {
		message = title
	}

	for i, match := range evalContext.EvalMatches {
		message += fmt.Sprintf("\n%2d. %s: %s", i+1, match.Metric, match.Value)
	}
	message += fmt.Sprintf("\n%s", messageURL)

	var bodyMsg map[string]interface{}
	if lark.MsgType == "text" {
		content := map[string]string{
			"text": message,
		}

		bodyMsg = map[string]interface{}{
			"msg_type": "text",
			"content":  content,
		}
	}
	return json.Marshal(bodyMsg)
}
