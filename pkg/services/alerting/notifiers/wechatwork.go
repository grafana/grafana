package notifiers

import (
	"encoding/json"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"strconv"
	"strings"
	"time"
)

const (
	template = `Title: {title}
Message: {message}
Url: {ruleUrl}
Timestamp: {timestamp}`
	helpUrl = "http://work.weixin.qq.com/api/doc?st=303C1EF34C5129D5A82536494080A6FBCEC1E6A1F09F4BF987C7953269A0C742D351183C3D7483047231E79195159767419412B1824891744E6FC0DD1B38E402DE22B64580BFBA699D4D0DFF190D88022A99D5930103A69185659691CF4764C3410A89F639C0259A2D6400A198A2FE654E9BFEE4AA62DE8A9D28226D84A96E66452CEE5ED8FA69D95480B4D35865B3F9&vid=1688850523107851&version=2.5.0.3027&platform=mac#14404"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "wechatwork",
		Name:        "WeChat Work",
		Description: "Sends notifications to WeChat Work via group bot",
		Factory:     NewWechatWorkNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">WeChat Work settings</h3>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Webhook</span>
        <input type="text" required class="gf-form-input max-width-30" ng-model="ctrl.model.settings.url"
		  placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxx"></input>
      </div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Msg Type</span>
        <div class="gf-form-select-wrapper width-14">
          <select class="gf-form-input"
			required
			ng-model="ctrl.model.settings.msgtype"
			ng-options="t for t in ['text', 'markdown']"
			ng-init="ctrl.model.settings.msgtype = 'text'">
          </select>
        </div>
      </div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Template</span>
        <textarea rows="7" class="gf-form-input width-27"
		  ng-model="ctrl.model.settings.template"
		  ng-init="ctrl.model.settings.template= '` + template + `'"></textarea>
        <info-popover mode="right-absolute">
          Message template, Support variable:
		  {title} {message} {ruleUrl} {timestamp}
        </info-popover>
      </div>
      <div class="gf-form">
	      <span>Click <a href="` + helpUrl + `" target="_blank">here</a> for detail documentation.</span>
      </div>
    `,
	})

}

func NewWechatWorkNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	template := model.Settings.Get("template").MustString()
	msgtype := model.Settings.Get("msgtype").MustString()

	return &WechatWorkNotifier{
		NotifierBase: NewNotifierBase(model),
		Url:          url,
		Template:     template,
		MsgType:      msgtype,
		log:          log.New("alerting.notifier.wechatwork"),
	}, nil
}

type WechatWorkNotifier struct {
	NotifierBase
	Url      string
	Template string
	MsgType  string
	log      log.Logger
}

func (w *WechatWorkNotifier) Notify(evalContext *alerting.EvalContext) error {
	w.log.Info("Executing WeChat Work notification", "ruleId", evalContext.Rule.Id, "notification", w.Name)

	ruleUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		w.log.Error("Failed get rule link", "error", err)
		return err
	}

	title := evalContext.GetNotificationTitle()
	message := evalContext.Rule.Message

	body := map[string]interface{}{
		"msgtype": w.MsgType,
		w.MsgType: map[string]string{
			"content": w.GenerateMessageBody(w.Template, title, message, ruleUrl),
		},
	}

	data, _ := json.Marshal(&body)
	cmd := &m.SendWebhookSync{Url: w.Url, Body: string(data)}
	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		w.log.Error("Failed to send WeChat Work notification", "error", err, "webhook", w.Name)
		return err
	}

	return nil
}

func (w *WechatWorkNotifier) GenerateMessageBody(body, title, message, ruleUrl string) string {
	if body == "" {
		body = template
	}

	timestamp := strconv.FormatInt(time.Now().Unix(), 10)

	body = strings.Replace(body, "{title}", title, -1)
	body = strings.Replace(body, "{message}", message, -1)
	body = strings.Replace(body, "{ruleUrl}", ruleUrl, -1)
	body = strings.Replace(body, "{timestamp}", timestamp, -1)

	return body
}
