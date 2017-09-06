package notifiers

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "dingding",
		Name:        "DingDing",
		Description: "Sends HTTP POST request to DingDing",
		Factory:     NewDingDingNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">DingDing settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-10">Url</span>
        <input type="text" required class="gf-form-input max-width-26" ng-model="ctrl.model.settings.url" placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxxxxxxxx"></input>
      </div>
    `,
	})

}

func NewDingDingNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	return &DingDingNotifier{
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		Url:          url,
		log:          log.New("alerting.notifier.dingding"),
	}, nil
}

type DingDingNotifier struct {
	NotifierBase
	Url string
	log log.Logger
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

	bodyJSON, err := simplejson.NewJson([]byte(`{
		"msgtype": "link",
		"link": {
			"text": "` + message + `",
			"title": "` + title + `",
			"picUrl": "` + picUrl + `",
			"messageUrl": "` + messageUrl + `"
		}
	}`))

	if err != nil {
		this.log.Error("Failed to create Json data", "error", err, "dingding", this.Name)
	}

	body, _ := bodyJSON.MarshalJSON()

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
