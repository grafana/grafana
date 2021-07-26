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
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "gitlab",
		Name:        "GitLab",
		Description: "Sends notifications to GitLab",
		Heading:     "GitLab settings",
		Factory:     NewGitLabNotifier,
		Options: []alerting.NotifierOption{
			{
				Label:        "Alert API Url",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "https://gitlab.com/namespace/project/alerts/notify/grafana/abc123.json",
				PropertyName: "apiUrl",
				Required:     true,
			},
			{
				Label:        "Auth Token",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "GitLab Auth Token",
				PropertyName: "authKey",
				Required:     true,
				Secure:       true,
			},
			{
				Label:        "Auto resolve alerts",
				Element:      alerting.ElementTypeCheckbox,
				Description:  "Automatically close alerts in GitLab once the alert state returns to OK.",
				PropertyName: "autoResolve",
			},
		},
	})
}

// NewGitLabotifier is the constructor for GitLab.
func NewGitLabNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	autoResolve := model.Settings.Get("autoResolve").MustBool(true)
	authKey := model.DecryptedValue("authKey", model.Settings.Get("authKey").MustString())
	apiURL := model.Settings.Get("apiUrl").MustString()
	if authKey == "" {
		return nil, alerting.ValidationError{Reason: "Could not find auth key property in settings"}
	}

	if apiURL == "" {
		return nil, alerting.ValidationError{Reason: "Could not find API URL property in settings"}
	}

	return &GitLabNotifier{
		NotifierBase:     NewNotifierBase(model),
		APIUrl:            apiURL,
		AuthKey:           authKey,
		AutoResolve:       autoResolve,
		log:              log.New("alerting.notifier.gitlab"),
	}, nil
}

// GitLabNotifier is responsible for sending
// alert notifications to GitLab
type GitLabNotifier struct {
	NotifierBase
	APIUrl           string
	AuthKey          string
	AutoResolve      bool
	log              log.Logger
}

// Notify sends an alert notification to GitLab.
func (gl *GitLabNotifier) Notify(evalContext *alerting.EvalContext) error {
	var err error
	switch evalContext.Rule.State {
	case models.AlertStateOK:
		if gl.AutoResolve {
			err = gl.submitAlert(evalContext, true)
		}
	case models.AlertStateAlerting:
		err = gl.submitAlert(evalContext, false)
	default:
		// Handle other cases?
	}
	return err
}

func (gl *GitLabNotifier) submitAlert(evalContext *alerting.EvalContext, resolveAlert bool) error {
	gl.log.Info("Creating GitLab alert", "ruleId", evalContext.Rule.ID, "notification", gl.Name, "resolveAlert", resolveAlert)

	ruleURL, err := evalContext.GetRuleURL()
	if err != nil {
		gl.log.Error("Failed get rule link", "error", err)
		return err
	}

	// https://docs.gitlab.com/ee/operations/incident_management/integrations.html#customize-the-alert-payload-outside-of-gitlab
	bodyJSON := simplejson.New()
	bodyJSON.Set("title", evalContext.Rule.Name)
	bodyJSON.Set("source_url", ruleURL)
	bodyJSON.Set("monitoring_tool", "Grafana")
	bodyJSON.Set("description", fmt.Sprintf("%s - %s\n%s\n", evalContext.Rule.Name, ruleURL, evalContext.Rule.Message))
	bodyJSON.Set("start_time", evalContext.StartTime)

	if resolveAlert == true {
		bodyJSON.Set("end_time", evalContext.EndTime)
	}

	for _, tag := range evalContext.Rule.AlertRuleTags {
		bodyJSON.Set(tag.Key, tag.Value)
	}

	body, _ := bodyJSON.MarshalJSON()

	cmd := &models.SendWebhookSync{
		Url:        gl.APIUrl,
		Body:       string(body),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type":  "application/json",
			"Authorization": fmt.Sprintf("Bearer %s", gl.AuthKey),
		},
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		gl.log.Error("Failed to send notification to GitLab", "error", err, "body", string(body))
	}

	return nil
}
