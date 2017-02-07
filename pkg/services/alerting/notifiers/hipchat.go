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

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "hipchat",
		Name:        "HipChat",
		Description: "Sends notifications uto a HipChat Room",
		Factory:     NewHipChatNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">HipChat settings</h3>
			      <div class="gf-form max-width-30">
			        <span class="gf-form-label width-6">Hip Chat Url</span>
			        <input type="text" required class="gf-form-input max-width-30" ng-model="ctrl.model.settings.url" placeholder="HipChat URL"></input>
			      </div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">API Key</span>
        <input type="text" required class="gf-form-input max-width-30" ng-model="ctrl.model.settings.apikey" placeholder="HipChat API Key"></input>
      </div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Room ID</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.roomid"
          data-placement="right">
        </input>
      </div>
    `,
	})

}

func NewHipChatNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if strings.HasSuffix(url, "/") {
		url = url[:len(url)-1]
	}
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	apikey := model.Settings.Get("apikey").MustString()
	roomid := model.Settings.Get("roomid").MustString()

	return &HipChatNotifier{
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		Url:          url,
		ApiKey:       apikey,
		RoomId:       roomid,
		log:          log.New("alerting.notifier.hipchat"),
	}, nil
}

type HipChatNotifier struct {
	NotifierBase
	Url    string
	ApiKey string
	RoomId string
	log    log.Logger
}

func (this *HipChatNotifier) Notify(evalContext *alerting.EvalContext) error {
	var message string
	var color string

	this.log.Info("Executing hipchat notification", "ruleId", evalContext.Rule.Id, "notification", this.Name)

	ruleUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed get rule link", "error", err)
		return err
	}

	message = evalContext.GetNotificationTitle() + " in state " + evalContext.GetStateModel().Text + "<br><a href=" + ruleUrl + ">Check Dasboard</a>"
	fields := make([]map[string]interface{}, 0)
	fieldLimitCount := 4
	message += "<br>"
	for index, evt := range evalContext.EvalMatches {
		message += evt.Metric + " :: " + strconv.FormatFloat(evt.Value.Float64, 'f', -1, 64) + "<br>"
		fields = append(fields, map[string]interface{}{
			"title": evt.Metric,
			"value": evt.Value,
			"short": true,
		})
		if index > fieldLimitCount {
			break
		}
	}

	if evalContext.Error != nil {
		fields = append(fields, map[string]interface{}{
			"title": "Error message",
			"value": evalContext.Error.Error(),
			"short": false,
		})
	}

	if evalContext.Rule.State != m.AlertStateOK { //dont add message when going back to alert state ok.
		message += " " + evalContext.Rule.Message
	}
	//HipChat has a set list of colors
	switch evalContext.Rule.State {
	case m.AlertStateOK:
		color = "green"
	case m.AlertStateNoData:
		color = "grey"
	case m.AlertStateAlerting:
		color = "red"
	}

	// Add a card with link to the dashboard
	card := map[string]interface{}{
		"style":       "link",
		"url":         ruleUrl,
		"id":          "1",
		"title":       evalContext.GetNotificationTitle(),
		"description": evalContext.GetNotificationTitle() + " in state " + evalContext.GetStateModel().Text,
		"icon": map[string]interface{}{
			"url": "http://grafana.org/assets/img/fav32.png",
		},
		"date": time.Now().Unix(),
	}

	body := map[string]interface{}{
		"message":        message,
		"notify":         "true",
		"message_format": "html",
		"color":          color,
		"card":           card,
	}
	hipUrl := this.Url + "/v2/room/" + this.RoomId + "/notification?auth_token=" + this.ApiKey
	data, _ := json.Marshal(&body)
	cmd := &m.SendWebhookSync{Url: hipUrl, Body: string(data)}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send hipchat notification", "error", err, "webhook", this.Name)
		return err
	}

	return nil
}
