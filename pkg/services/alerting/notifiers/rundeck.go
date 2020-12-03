package notifiers

import (
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "rundeck",
		Name:        "Rundeck",
		Description: "Triggers a Rundeck Job on Alert",
		Heading:     "Rundeck Settings",
		Factory:     NewRundeckNotifier,
		Options: []alerting.NotifierOption{
			{
				Label:        "URL",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				PropertyName: "url",
				Required:     true,
			},
			{
				Label:        "Auth Token",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				PropertyName: "authtoken",
				Required:     true,
			},
			{
				Label:        "Job ID",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				PropertyName: "jobid",
				Required:     true,
			},
		},
	})
}

// NewRundeckNotifier is the constructor for the rundeck notifier.
func NewRundeckNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}
	authToken := model.Settings.Get("authtoken").MustString()
	if authToken == "" {
		return nil, alerting.ValidationError{Reason: "Could not find auth token property in settings"}
	}
	jobID := model.Settings.Get("jobid").MustString()
	if jobID == "" {
		return nil, alerting.ValidationError{Reason: "Could not find job id property in settings"}
	}

	return &RundeckNotifier{
		NotifierBase: NewNotifierBase(model),
		URL:          fmt.Sprintf("%s/api/12/job/%s/executions", url, jobID),
		AuthToken:    authToken,
		log:          log.New("alerting.notifier.rundeck"),
	}, nil
}

// RundeckNotifier is responsible for invoking Rundeck jobs on Alerts
type RundeckNotifier struct {
	NotifierBase
	URL       string
	AuthToken string
	log       log.Logger
}

// Notify send alert notifications as rundeck as http requests.
func (rn *RundeckNotifier) Notify(evalContext *alerting.EvalContext) error {
	if evalContext.Rule.State == models.AlertStateAlerting {
		rn.log.Info("Sending rundeck")
		cmd := &models.SendWebhookSync{
			Url:        rn.URL,
			HttpMethod: "POST",
			HttpHeader: map[string]string{
				"X-Rundeck-Auth-Token": rn.AuthToken,
			},
		}

		if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
			rn.log.Error("Failed to send Rundeck", "error", err, "rundeck", rn.Name)
			return err
		}
	}
	return nil
}
