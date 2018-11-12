package notifiers

import (
	"fmt"
	"net/url"

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
        <input type="text" required class="gf-form-input max-width-70" ng-model="ctrl.model.settings.url" placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxxx"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">MessageType</span>
        <select class="gf-form-input max-width-14" ng-model="ctrl.model.settings.msgType" ng-options="s for s in ['link','actionCard']" ng-init="ctrl.model.settings.msgType=ctrl.model.settings.msgType || '` + DefaultDingdingMsgType + `'"></select>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">OpenInBrowser</span>
        <gf-form-switch class="gf-form" checked="ctrl.model.settings.openInBrowser"></gf-form-switch>
        <info-popover mode="right-normal">Open the message url in browser instead of inside of Dingding</info-popover>
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
	openInBrowser := model.Settings.Get("openInBrowser").MustBool(true)

	return &DingDingNotifier{
		NotifierBase:  NewNotifierBase(model),
		OpenInBrowser: openInBrowser,
		MsgType:       msgType,
		Url:           url,
		log:           log.New("alerting.notifier.dingding"),
	}, nil
}

type DingDingNotifier struct {
	NotifierBase
	MsgType       string
	OpenInBrowser bool //Set whether the message url will open outside of Dingding
	Url           string
	log           log.Logger
}

func (this *DingDingNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Sending dingding")

	messageUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed to get messageUrl", "error", err, "dingding", this.Name)
		messageUrl = ""
	}

	if this.OpenInBrowser {
		q := url.Values{
			"pc_slide": {"false"},
			"url":      {messageUrl},
		}

		// Use special link to auto open the message url outside of Dingding
		// Refer: https://open-doc.dingtalk.com/docs/doc.htm?treeId=385&articleId=104972&docType=1#s9
		messageUrl = "dingtalk://dingtalkclient/page/link?" + q.Encode()
	}

	this.log.Info("messageUrl:" + messageUrl)

	message := evalContext.Rule.Message
	picUrl := evalContext.ImagePublicUrl
	title := evalContext.GetNotificationTitle()
	if message == "" {
		message = title
	}

	for i, match := range evalContext.EvalMatches {
		message += fmt.Sprintf("\\n%2d. %s: %s", i+1, match.Metric, match.Value)
	}

	var bodyStr string
	if this.MsgType == "actionCard" {
		// Embed the pic into the markdown directly because actionCard doesn't have a picUrl field
		if picUrl != "" {
			message = "![](" + picUrl + ")\\n\\n" + message
		}

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
