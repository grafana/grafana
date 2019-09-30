package notifiers

import (
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	componentStatus := ` 
          'major_outage',
          'partial_outage',
          'degraded_performance',
          'under_maintenance',
          'operational',
          ''`

	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "statuspage",
		Name:        "StatusPage",
		Description: "Sends notifications to StatusPage",
		Factory:     NewStatusPageNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">StatusPage settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-14">API Key</span>
        <input type="text" required class="gf-form-input max-width-22" ng-model="ctrl.model.settings.apiKey" placeholder="StatusPage API Key"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-14">API Url</span>
        <input type="text" required class="gf-form-input max-width-22" ng-model="ctrl.model.settings.apiUrl" placeholder="https://api.statuspage.io/v1/pages" value="https://api.statuspage.io/v1/pages"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-14">Page ID</span>
        <input type="text" required class="gf-form-input max-width-22" ng-model="ctrl.model.settings.pageId" placeholder=""></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-14">Component ID</span>
        <input type="text" required class="gf-form-input max-width-22" ng-model="ctrl.model.settings.componentId" placeholder=""></input>
      </div>

      <div class="gf-form">
        <span class="gf-form-label width-10">On alert, set status to</span>
        <select class="gf-form-input max-width-14" ng-model="ctrl.model.settings.componentStatusWhenAlerting" ng-options="s for s in [
          ` + componentStatus + `
        ]" ng-init="ctrl.model.settings.componentStatusWhenAlerting=ctrl.model.settings.componentStatusWhenAlerting||''"></select>
      </div>
    `,
	})
}

var (
	StatusPageAlertURL = "https://api.statuspage.io/v1/pages"
	OKStatus           = "operational"
	DOWNStatus         = "major_outage"
)

// NewStatusPageNotifier is the constructor for StatusPage.
func NewStatusPageNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	apiKey := model.Settings.Get("apiKey").MustString()
	apiURL := model.Settings.Get("apiUrl").MustString()
	componentId := model.Settings.Get("componentId").MustString()
	pageId := model.Settings.Get("pageId").MustString()
	componentStatusWhenAlerting := model.Settings.Get("componentStatusWhenAlerting").MustString()
	if apiKey == "" {
		return nil, alerting.ValidationError{Reason: "Could not find api key property in settings"}
	}
	if componentId == "" {
		return nil, alerting.ValidationError{Reason: "Could not find componentId key property in settings"}
	}
	if pageId == "" {
		return nil, alerting.ValidationError{Reason: "Could not find pageId key property in settings"}
	}
	if apiURL == "" {
		apiURL = StatusPageAlertURL
	}
	if componentStatusWhenAlerting == "" {
		componentStatusWhenAlerting = DOWNStatus
	}

	return &StatusPageNotifier{
		NotifierBase: NewNotifierBase(model),
		APIKey:       apiKey,
		APIUrl:       apiURL,
		PageID:       pageId,
		ComponentID:  componentId,
		Status:       componentStatusWhenAlerting,
		log:          log.New("alerting.notifier.StatusPage"),
	}, nil
}

// StatusPageNotifier is responsible for sending
// alert notifications to StatusPage
type StatusPageNotifier struct {
	NotifierBase
	APIKey      string
	APIUrl      string
	PageID      string
	ComponentID string
	Status      string
	log         log.Logger
}

// Notify sends an alert notification to StatusPage.
func (on *StatusPageNotifier) Notify(evalContext *alerting.EvalContext) error {
	var err error
	switch evalContext.Rule.State {
	case models.AlertStateOK:
		if !on.GetDisableResolveMessage() {
			err = on.updateStatus(evalContext, OKStatus)
		}
	case models.AlertStateAlerting:
		err = on.updateStatus(evalContext, on.Status)
	}
	return err
}

func (on *StatusPageNotifier) updateStatus(evalContext *alerting.EvalContext, status string) error {
	on.log.Info("Updating StatusPage alert", "ruleId", evalContext.Rule.ID, "notification", on.Name)

	statusJSON := simplejson.New()
	statusJSON.Set("status", status)
	bodyJSON := simplejson.New()
	bodyJSON.Set("component", statusJSON)

	body, _ := bodyJSON.MarshalJSON()

	cmd := &models.SendWebhookSync{
		Url:        on.APIUrl + "/" + on.PageID + "/components/" + on.ComponentID,
		Body:       string(body),
		HttpMethod: "PATCH",
		HttpHeader: map[string]string{
			"Content-Type":  "application/json",
			"Authorization": fmt.Sprintf("OAuth %s", on.APIKey),
		},
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		on.log.Error("Failed to send notification to StatusPage", "error", err, "body", string(body))
	}

	return nil
}
