package notifiers

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

const defaultWeChatWorkMsgType = "link"
const wechatworkOptionsTemplate = `
      <h3 class="page-heading">WeChat Work settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-10">WeChat Work Robot Webhook Url</span>
        <input type="text" required class="gf-form-input max-width-70" ng-model="ctrl.model.settings.url" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxx"></input>
      </div>
`

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:            "wechatwork",
		Name:            "WeChat Work",
		Description:     "Sends HTTP POST request to WeChat Work",
		Heading:         "WeChat Work settings",
		Factory:         newWeChatWorkNotifier,
		OptionsTemplate: wechatworkOptionsTemplate,
		Options: []alerting.NotifierOption{
			{
				Label:        "Url",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxx",
				PropertyName: "url",
				Required:     true,
			},
		},
	})
}

func newWeChatWorkNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	msgType := model.Settings.Get("msgType").MustString(defaultWeChatWorkMsgType)

	return &WeChatWorkNotifier{
		NotifierBase: NewNotifierBase(model),
		MsgType:      msgType,
		URL:          url,
		log:          log.New("alerting.notifier.wechatwork"),
	}, nil
}

// WeChatWorkNotifier is responsible for sending alert notifications to WeChat Work.
type WeChatWorkNotifier struct {
	NotifierBase
	MsgType string
	URL     string
	log     log.Logger
}

// Notify sends the alert notification to WeChat Work.
func (ww *WeChatWorkNotifier) Notify(evalContext *alerting.EvalContext) error {
	ww.log.Info("Sending WeChat Work")

	messageURL, err := evalContext.GetRuleURL()
	if err != nil {
		ww.log.Error("Failed to get messageUrl", "error", err, "wechatwork", ww.Name)
		messageURL = ""
	}

	body, err := ww.genBody(evalContext, messageURL)
	if err != nil {
		return err
	}

	cmd := &models.SendWebhookSync{
		Url:  ww.URL,
		Body: string(body),
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		ww.log.Error("Failed to send WeChat Work", "error", err, "wechatwork", ww.Name)
		return err
	}

	return nil
}

func (ww *WeChatWorkNotifier) genBody(evalContext *alerting.EvalContext, messageURL string) ([]byte, error) {

	message := evalContext.Rule.Message
	picURL := evalContext.ImagePublicURL
	title := evalContext.GetNotificationTitle()
	if message == "" {
		message = title
	}

	for i, match := range evalContext.EvalMatches {
		message += fmt.Sprintf("\\n%2d. %s: %s", i+1, match.Metric, match.Value)
	}

	var bodyMsg map[string]interface{}

	article := map[string]string{
		"title":       title,
		"description": message,
		"url":         messageURL,
		"picurl":      picURL,
	}

	var articleList = make([]map[string]string, 0)
	articleList = append(articleList, article)

	bodyMsg = map[string]interface{}{
		"msgtype": "news",
		"news": map[string][]map[string]string{
			"articles": articleList,
		},
	}

	return json.Marshal(bodyMsg)
}
