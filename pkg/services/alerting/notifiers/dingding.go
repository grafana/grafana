package notifiers

import (
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

const DefaultDingdingMsgType = "link"
const DingdingOptionsTemplate = `
      <h3 class="page-heading">DingDing settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-10">Url</span>
        <input type="text" required class="gf-form-input max-width-26" ng-model="ctrl.model.settings.url" placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxxx"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">MessageType</span>
        <select class="gf-form-input max-width-14" ng-model="ctrl.model.settings.msgType" ng-options="s for s in ['link','actionCard']" ng-init="ctrl.model.settings.msgType=ctrl.model.settings.msgType || '` + DefaultDingdingMsgType + `'"></select>
      </div>
`

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:            "dingding",
		Name:            "DingDing",
		Description:     "Sends HTTP POST request to DingDing",
		Factory:         NewDingDingNotifier,
		OptionsTemplate: DingdingOptionsTemplate,
	})

}

func NewDingDingNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	msgType := model.Settings.Get("msgType").MustString(DefaultDingdingMsgType)

	return &DingDingNotifier{
		NotifierBase: NewNotifierBase(model),
		MsgType:      msgType,
		Url:          url,
		log:          log.New("alerting.notifier.dingding"),
	}, nil
}

type DingDingNotifier struct {
	NotifierBase
	MsgType string
	Url     string
	log     log.Logger
}

func (this *DingDingNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Sending dingding")

	messageUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed to get messageUrl", "error", err, "dingding", this.Name)
		messageUrl = ""
	}
	this.log.Info("messageUrl:" + messageUrl)

	message := evalContext.Rule.Message
	picUrl := evalContext.ImagePublicUrl
	title := evalContext.GetNotificationTitle()
	if message == "" {
		message = title
	}

	for i, match := range evalContext.EvalMatches {
		message += fmt.Sprintf("\\n%2d. %s value %s", i+1, match.Metric, match.Value)
	}

	var bodyStr string
	if this.MsgType == "actionCard" {
		bodyStr = `{
			"msgtype": "actionCard",
			"actionCard": {
				"text": "` + message + `",
				"title": "` + title + `",
				"singleTitle": "More",
				"singleURL": "` + messageUrl + `"
			}
		}`
	} else {
		bodyStr = `{
			"msgtype": "link",
			"link": {
				"text": "` + message + `",
				"title": "` + title + `",
				"picUrl": "` + picUrl + `",
				"messageUrl": "` + messageUrl + `"
			}
		}`
	}

	bodyJSON, err := simplejson.NewJson([]byte(bodyStr))

	if err != nil {
		this.log.Error("Failed to create Json data", "error", err, "dingding", this.Name)
	}

	body, err := bodyJSON.MarshalJSON()
	if err != nil {
		return err
	}

	cmd := &m.SendWebhookSync{
		Url:  this.Url,
		Body: string(body),
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send DingDing", "error", err, "dingding", this.Name)
		return err
	}

	return nil
}
