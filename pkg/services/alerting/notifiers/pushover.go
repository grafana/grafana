package notifiers

import (
	"fmt"
	"net/url"
	"strconv"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

const PUSHOVER_ENDPOINT = "https://api.pushover.net/1/messages.json"

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "pushover",
		Name:        "Pushover",
		Description: "Sends HTTP POST request to the Pushover API",
		Factory:     NewPushoverNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">Pushover settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-10">API Token</span>
        <input type="text" class="gf-form-input" required placeholder="Application token" ng-model="ctrl.model.settings.apiToken"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">User key(s)</span>
        <input type="text" class="gf-form-input" required placeholder="comma-separated list" ng-model="ctrl.model.settings.userKey"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">Device(s) (optional)</span>
        <input type="text" class="gf-form-input" placeholder="comma-separated list; leave empty to send to all devices" ng-model="ctrl.model.settings.device"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">Priority</span>
        <select class="gf-form-input max-width-14" ng-model="ctrl.model.settings.priority" ng-options="v as k for (k, v) in {
          Emergency: '2',
          High:      '1',
          Normal:    '0',
          Low:      '-1',
          Lowest:   '-2'
        }" ng-init="ctrl.model.settings.priority=ctrl.model.settings.priority||'0'"></select>
      </div>
      <div class="gf-form" ng-show="ctrl.model.settings.priority == '2'">
        <span class="gf-form-label width-10">Retry</span>
        <input type="text" class="gf-form-input max-width-14" ng-required="ctrl.model.settings.priority == '2'" placeholder="minimum 30 seconds" ng-model="ctrl.model.settings.retry" ng-init="ctrl.model.settings.retry=ctrl.model.settings.retry||'60'></input>
      </div>
      <div class="gf-form" ng-show="ctrl.model.settings.priority == '2'">
        <span class="gf-form-label width-10">Expire</span>
        <input type="text" class="gf-form-input max-width-14" ng-required="ctrl.model.settings.priority == '2'" placeholder="maximum 86400 seconds" ng-model="ctrl.model.settings.expire" ng-init="ctrl.model.settings.expire=ctrl.model.settings.expire||'3600'"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">Sound</span>
        <select class="gf-form-input max-width-14" ng-model="ctrl.model.settings.sound" ng-options="s for s in [
          'default',
          'pushover',
          'bike',
          'bugle',
          'cashregister',
          'classical',
          'cosmic',
          'falling',
          'gamelan',
          'incoming',
          'intermission',
          'magic',
          'mechanical',
          'pianobar',
          'siren',
          'spacealarm',
          'tugboat',
          'alien',
          'climb',
          'persistent',
          'echo',
          'updown',
          'none'
        ]" ng-init="ctrl.model.settings.sound=ctrl.model.settings.sound||'default'"></select>
      </div>
    `,
	})
}

func NewPushoverNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	userKey := model.Settings.Get("userKey").MustString()
	apiToken := model.Settings.Get("apiToken").MustString()
	device := model.Settings.Get("device").MustString()
	priority, _ := strconv.Atoi(model.Settings.Get("priority").MustString())
	retry, _ := strconv.Atoi(model.Settings.Get("retry").MustString())
	expire, _ := strconv.Atoi(model.Settings.Get("expire").MustString())
	sound := model.Settings.Get("sound").MustString()

	if userKey == "" {
		return nil, alerting.ValidationError{Reason: "User key not given"}
	}
	if apiToken == "" {
		return nil, alerting.ValidationError{Reason: "API token not given"}
	}
	return &PushoverNotifier{
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		UserKey:      userKey,
		ApiToken:     apiToken,
		Priority:     priority,
		Retry:        retry,
		Expire:       expire,
		Device:       device,
		Sound:        sound,
		log:          log.New("alerting.notifier.pushover"),
	}, nil
}

type PushoverNotifier struct {
	NotifierBase
	UserKey  string
	ApiToken string
	Priority int
	Retry    int
	Expire   int
	Device   string
	Sound    string
	log      log.Logger
}

func (this *PushoverNotifier) Notify(evalContext *alerting.EvalContext) error {
	ruleUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed get rule link", "error", err)
		return err
	}
	message := evalContext.Rule.Message
	for idx, evt := range evalContext.EvalMatches {
		message += fmt.Sprintf("\n<b>%s</b>: %v", evt.Metric, evt.Value)
		if idx > 4 {
			break
		}
	}
	if evalContext.Error != nil {
		message += fmt.Sprintf("\n<b>Error message:</b> %s", evalContext.Error.Error())
	}
	if evalContext.ImagePublicUrl != "" {
		message += fmt.Sprintf("\n<a href=\"%s\">Show graph image</a>", evalContext.ImagePublicUrl)
	}

	q := url.Values{}
	q.Add("user", this.UserKey)
	q.Add("token", this.ApiToken)
	q.Add("priority", strconv.Itoa(this.Priority))
	if this.Priority == 2 {
		q.Add("retry", strconv.Itoa(this.Retry))
		q.Add("expire", strconv.Itoa(this.Expire))
	}
	if this.Device != "" {
		q.Add("device", this.Device)
	}
	if this.Sound != "default" {
		q.Add("sound", this.Sound)
	}
	q.Add("title", evalContext.GetNotificationTitle())
	q.Add("url", ruleUrl)
	q.Add("url_title", "Show dashboard with alert")
	q.Add("message", message)
	q.Add("html", "1")

	cmd := &m.SendWebhookSync{
		Url:        PUSHOVER_ENDPOINT,
		HttpMethod: "POST",
		HttpHeader: map[string]string{"Content-Type": "application/x-www-form-urlencoded"},
		Body:       q.Encode(),
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send pushover notification", "error", err, "webhook", this.Name)
		return err
	}

	return nil
}
