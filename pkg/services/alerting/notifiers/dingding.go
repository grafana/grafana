package notifiers

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

const defaultDingdingMsgType = "link"
const dingdingOptionsTemplate = `
      <h3 class="page-heading">DingDing settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-10">Url</span>
        <input type="text" required class="gf-form-input max-width-70" ng-model="ctrl.model.settings.url" placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxxx"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">MessageType</span>
        <select class="gf-form-input max-width-14" ng-model="ctrl.model.settings.msgType" ng-options="s for s in ['link','actionCard']" ng-init="ctrl.model.settings.msgType=ctrl.model.settings.msgType || '` + defaultDingdingMsgType + `'"></select>
      </div>
`

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:            "dingding",
		Name:            "DingDing",
		Description:     "Sends HTTP POST request to DingDing",
		Factory:         newDingDingNotifier,
		OptionsTemplate: dingdingOptionsTemplate,
	})

}

func newDingDingNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	msgType := model.Settings.Get("msgType").MustString(defaultDingdingMsgType)

	return &DingDingNotifier{
		NotifierBase: NewNotifierBase(model),
		MsgType:      msgType,
		URL:          url,
		log:          log.New("alerting.notifier.dingding"),
	}, nil
}

// DingDingNotifier is responsible for sending alert notifications to ding ding.
type DingDingNotifier struct {
	NotifierBase
	MsgType string
	URL     string
	log     log.Logger
}

// Notify sends the alert notification to dingding.
func (dd *DingDingNotifier) Notify(evalContext *alerting.EvalContext) error {
	dd.log.Info("Sending dingding")

	messageURL, err := evalContext.GetRuleURL()
	if err != nil {
		dd.log.Error("Failed to get messageUrl", "error", err, "dingding", dd.Name)
		messageURL = ""
	}

	q := url.Values{
		"pc_slide": {"false"},
		"url":      {messageURL},
	}

	// Use special link to auto open the message url outside of Dingding
	// Refer: https://open-doc.dingtalk.com/docs/doc.htm?treeId=385&articleId=104972&docType=1#s9
	messageURL = "dingtalk://dingtalkclient/page/link?" + q.Encode()

	dd.log.Info("messageUrl:" + messageURL)

	message := evalContext.Rule.Message
	picURL := evalContext.ImagePublicURL
	title := evalContext.GetNotificationTitle()
	if message == "" {
		message = title
	}

	for i, match := range evalContext.EvalMatches {
		message += fmt.Sprintf("\\n%2d. %s: %s", i+1, match.Metric, match.Value)
	}

	var bodyStr string
	if dd.MsgType == "actionCard" {
		// Embed the pic into the markdown directly because actionCard doesn't have a picUrl field
		if picURL != "" {
			message = "![](" + picURL + ")\\n\\n" + message
		}

		bodyStr = `{
			"msgtype": "actionCard",
			"actionCard": {
				"text": "` + strings.Replace(message, `"`, "'", -1) + `",
				"title": "` + strings.Replace(title, `"`, "'", -1) + `",
				"singleTitle": "More",
				"singleURL": "` + messageURL + `"
			}
		}`
	} else {
		bodyStr = `{
			"msgtype": "link",
			"link": {
				"text": "` + message + `",
				"title": "` + title + `",
				"picUrl": "` + picURL + `",
				"messageUrl": "` + messageURL + `"
			}
		}`
	}

	bodyJSON, err := simplejson.NewJson([]byte(bodyStr))

	if err != nil {
		dd.log.Error("Failed to create Json data", "error", err, "dingding", dd.Name)
	}

	body, err := bodyJSON.MarshalJSON()
	if err != nil {
		return err
	}

	cmd := &models.SendWebhookSync{
		Url:  dd.URL,
		Body: string(body),
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		dd.log.Error("Failed to send DingDing", "error", err, "dingding", dd.Name)
		return err
	}

	return nil
}
