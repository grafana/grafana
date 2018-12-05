package notifiers

import (
	"fmt"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "onesignal",
		Name:        "OneSignal",
		Description: "Sends HTTP POST request to a onesignal API",
		Factory:     NewOneSignalNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">onesignal settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-10">Url</span>
				<input type="text" required class="gf-form-input max-width-26" ng-model="ctrl.model.settings.url" placeholder="http://onesignal-api.local:4567/results"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">Source</span>
        <input type="text" class="gf-form-input max-width-14" ng-model="ctrl.model.settings.source" bs-tooltip="'If empty rule id will be used'" data-placement="right"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">App_ID</span>
        <input type="text" class="gf-form-input max-width-14" ng-model="ctrl.model.settings.appId" placeholder="default"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">Rest API KEY</span>
        <input type="text" class="gf-form-input max-width-14" ng-model="ctrl.model.settings.restApiKey" placeholder="default"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">Segments</span>
        <input type="text" class="gf-form-input max-width-14" ng-model="ctrl.model.settings.includedSegments" placeholder="default"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">Username</span>
        <input type="text" class="gf-form-input max-width-14" ng-model="ctrl.model.settings.username"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">Password</span>
        <input type="text" class="gf-form-input max-width-14" ng-model="ctrl.model.settings.password"></input>
      </div>
    `,
	})

}

func NewOneSignalNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	return &OneSignalNotifier{
		NotifierBase:     NewNotifierBase(model),
		Url:              url,
		User:             model.Settings.Get("username").MustString(),
		Source:           model.Settings.Get("source").MustString(),
		Password:         model.Settings.Get("password").MustString(),
		AppId:            model.Settings.Get("appId").MustString(),
		IncludedSegments: model.Settings.Get("includedSegments").MustString(),
		RestApiKey:       model.Settings.Get("restApiKey").MustString(),
		log:              log.New("alerting.notifier.onesignal"),
	}, nil
}

type OneSignalNotifier struct {
	NotifierBase
	Url              string
	Source           string
	User             string
	Password         string
	AppId            string
	IncludedSegments string
	RestApiKey       string
	log              log.Logger
}

func (this *OneSignalNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Sending onesignal result")
	messageUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed to get messageUrl", "error", err, "onesignal", this.Name)
		messageUrl = ""
	}
	this.log.Info("messageUrl:" + messageUrl)

	message := evalContext.Rule.Message
	picUrl := evalContext.ImagePublicUrl
	title := evalContext.GetNotificationTitle()

	if message == "" {
		message = title
	}

	bodyJSON, err := simplejson.NewJson([]byte(`{
		"msgtype": "push",
		"contents": {
			"en": "` + message + `",
			"title": "` + title + `",
			"picUrl": "` + picUrl + `",
			"messageUrl": "` + messageUrl + `"
		}
	}`))
	if err != nil {
		this.log.Error("Failed to create Json data", "error", err, "onesignal", this.Name)
	}

	bodyJSON.Set("ruleId", evalContext.Rule.Id)
	// onesignal alerts cannot have spaces in them
	bodyJSON.Set("name", strings.Replace(evalContext.Rule.Name, " ", "_", -1))
	// onesignal alerts require a source. We set it to the user-specified value (optional),
	// else we fallback and use the grafana ruleID.
	if this.Source != "" {
		bodyJSON.Set("source", this.Source)
	} else {
		bodyJSON.Set("source", "grafana_rule_"+strconv.FormatInt(evalContext.Rule.Id, 10))
	}
	// Finally, onesignal expects an output
	// We set it to a default output
	bodyJSON.Set("output", "Grafana Metric Condition Met")
	bodyJSON.Set("evalMatches", evalContext.EvalMatches)

	if evalContext.Rule.State == "alerting" {
		bodyJSON.Set("status", 2)
	} else if evalContext.Rule.State == "no_data" {
		bodyJSON.Set("status", 1)
	} else {
		bodyJSON.Set("status", 0)
	}

	if this.AppId != "" {
		bodyJSON.Set("app_id", this.AppId)
	}

	if this.IncludedSegments != "" {
		bodyJSON.Set("included_segments", this.IncludedSegments)
	}

	ruleUrl, err := evalContext.GetRuleUrl()
	if err == nil {
		bodyJSON.Set("ruleUrl", ruleUrl)
	}

	if evalContext.ImagePublicUrl != "" {
		bodyJSON.Set("imageUrl", evalContext.ImagePublicUrl)
	}

	if evalContext.Rule.Message != "" {
		bodyJSON.Set("output", evalContext.Rule.Message)
	}

	if err != nil {
		this.log.Error("Failed to create Json data", "error", err, "onesignal", this.Name)
	}
	body, _ := bodyJSON.MarshalJSON()

	cmd := &m.SendWebhookSync{
		Url:      this.Url,
		User:     this.User,
		Password: this.Password,
		Body:     string(body),
		HttpHeader: map[string]string{
			"Authorization": fmt.Sprintf("Basic %s", this.RestApiKey),
		},
		HttpMethod: "POST",
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send onesignal event", "error", err, "onesignal", this.Name)
		return err
	}

	return nil
}
