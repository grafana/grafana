package notifiers

import (
	"fmt"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "matrix",
		Name:        "Matrix",
		Description: "Sends notifications to Matrix room",
		Factory:     NewMatrixNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">Matrix settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-10">Matrix room URL</span>
        <input type="text" required class="gf-form-input" ng-model="ctrl.model.settings.url" placeholder="https://matrix.example.org/_matrix/client/r0/rooms"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">Room ID</span>
        <input type="text" required class="gf-form-input" ng-model="ctrl.model.settings.roomid" placeholder="Matrix Room ID"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">Token</span>
        <input type="text" required class="gf-form-input" ng-model="ctrl.model.settings.token" placeholder="Authentication Token"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">Message Type</span>
        <div class="gf-form-select-wrapper width-10">
          <select class="gf-form-input" ng-model="ctrl.model.settings.msgtype" ng-options="t for t in ['m.notice', 'm.text']"
            ng-init="ctrl.model.settings.msgtype=ctrl.model.settings.msgtype||'m.notice'">
          </select>
        </div>
      </div>
    `,
	})

}

func NewMatrixNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}
	roomid := model.Settings.Get("roomid").MustString()
	if roomid == "" {
		return nil, alerting.ValidationError{Reason: "Could not find roomid property in settings"}
	}
	token := model.Settings.Get("token").MustString()
	if token == "" {
		return nil, alerting.ValidationError{Reason: "Could not find token property in settings"}
	}

	return &MatrixNotifier{
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		URL:          url,
		RoomID:       roomid,
		Token:        token,
		MsgType:      model.Settings.Get("msgtype").MustString("m.notice"),
		log:          log.New("alerting.notifier.matrix"),
	}, nil
}

type MatrixNotifier struct {
	NotifierBase
	URL        string
	RoomID     string
	Token      string
	MsgType    string
	log        log.Logger
}

func (this *MatrixNotifier) ShouldNotify(context *alerting.EvalContext) bool {
	return defaultShouldNotify(context)
}

func (this *MatrixNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Sending Matrix notify message")

	bodyJSON := simplejson.New()

	message := evalContext.GetNotificationTitle()
	message += " " + evalContext.Rule.Message

	ruleUrl, err := evalContext.GetRuleUrl()
	if err == nil {
		message += " " + ruleUrl
	}

	bodyJSON.Set("msgtype", this.MsgType)
	bodyJSON.Set("body", message)

	body, _ := bodyJSON.MarshalJSON()
	matrixUrl := fmt.Sprintf("%s/%s/send/m.room.message?access_token=%s", this.URL, this.RoomID, this.Token)
	cmd := &m.SendWebhookSync{Url: matrixUrl, Body: string(body)}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send Matrix notify message", "error", err, "webhook", this.Name)
		return err
	}

	return nil
}
