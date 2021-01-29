package notifiers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "jira",
		Name:        "Jira",
		Description: "Create Jira issue based on notifications",
		Factory:     NewJiraNotifier,
		Heading:     "Jira settings",
		Options: []alerting.NotifierOption{
			{
				Label:        "Jira URL",
				Description:  "URL to the Jira API i.e. https://company.atlassian.net/rest/api/2/issue/",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				PropertyName: "url",
				Placeholder:  "https://company.atlassian.net/rest/api/2/issue/",
				Required:     true,
			},
			{
				Label:        "Project name",
				Description:  "Name of the Jira project where the issue should be created",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				PropertyName: "project",
				Required:     true,
			},
			{
				Label:        "Type",
				Description:  "Type of the issue to be created, normally something like Bug, Task etc..",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "Bug",
				PropertyName: "type",
				Required:     true,
			},
			{
				Label:        "Priority",
				Description:  "Priority of the issue to be created, normally something like Low, Medium,High or Cirtical",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "High",
				PropertyName: "priority",
				Required:     true,
			},
			{
				Label:        "Username",
				Description:  "Name of the user creating the bug, typically an email address",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				PropertyName: "username",
				Required:     true,
			},
			{
				Label:        "Token",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "Jira API token",
				PropertyName: "token",
				Required:     true,
				Secure:       true,
			},
		},
	})
}

// JiraNotifier is responsible for sending alert notifications over jira.
type JiraNotifier struct {
	NotifierBase
	log      log.Logger
	URL      string
	Project  string
	Type     string
	Priority string
	Username string
	Token    string
}

// NewJiraNotifier is the constructor function for the JiraNotifier.
func NewJiraNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	project := model.Settings.Get("project").MustString()
	issuetype := model.Settings.Get("type").MustString()
	priority := model.Settings.Get("priority").MustString()
	username := model.Settings.Get("username").MustString()
	token := model.DecryptedValue("token", model.Settings.Get("token").MustString())

	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find URL in settings"}
	}
	if project == "" {
		return nil, alerting.ValidationError{Reason: "Could not find project name in settings"}
	}
	if issuetype == "" {
		return nil, alerting.ValidationError{Reason: "Could not find type name in settings"}
	}
	if priority == "" {
		return nil, alerting.ValidationError{Reason: "Could not find type priority in settings"}
	}
	if username == "" {
		return nil, alerting.ValidationError{Reason: "Could not find username in settings"}
	}
	if token == "" {
		return nil, alerting.ValidationError{Reason: "Could not find token in settings"}
	}

	return &JiraNotifier{
		NotifierBase: NewNotifierBase(model),
		URL:          url,
		Project:      project,
		Type:         issuetype,
		Priority:     priority,
		Username:     username,
		Token:        token,
		log:          log.New("alerting.notifier.jira"),
	}, nil
}

// Notify sends the actual alert notification via http(s).
func (en *JiraNotifier) Notify(evalContext *alerting.EvalContext) error {
	en.log.Info(fmt.Sprintf("Creating issue in project '%v'", en.Project))

	ruleURL, err := evalContext.GetRuleURL()
	if err != nil {
		en.log.Error("Failed get rule link", "error", err)
		return err
	}

	msg := evalContext.Rule.Message
	msg = msg + "\n" + evalContext.ImagePublicURL
	msg += generateFieldMessage(evalContext)
	body, err := generateJSONBody(en, evalContext.GetNotificationTitle(), msg, ruleURL)
	if err != nil {
		return err
	}
	cmd := &models.SendWebhookSync{
		Url:        en.URL,
		User:       en.Username,
		Password:   en.Token,
		Body:       body,
		HttpMethod: http.MethodPost,
	}
	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		en.log.Error("Failed to send slack notification", "error", err, "webhook", en.Name)
		return err
	}
	return nil
}

// generateFieldMessage generates a simple string with the metrics from the eval context
func generateFieldMessage(evalContext *alerting.EvalContext) string {
	metrics := ""
	for _, e := range evalContext.EvalMatches {
		metrics += fmt.Sprintf("\n%s: %s", e.Metric, e.Value)
	}
	return metrics
}

func generateJSONBody(j *JiraNotifier, summary string, description string, ruleurl string) (string, error) {
	i := Issue{
		Fields{Project: Project{j.Project}, Issuetype: Issuetype{j.Type}, Priority: PriorityType{j.Priority}, Summary: summary, Description: description},
	}
	d, err := json.Marshal(i)
	if err != nil {
		return "", err
	}
	return string(d), nil
}

// Issue is the main Jira issue
type Issue struct {
	Fields Fields `json:"fields"`
}

// Project the name of the project to craete the issue in
type Project struct {
	Key string `json:"key"`
}

// Issuetype the type of the issue
type Issuetype struct {
	Name string `json:"name"`
}

// PriorityType the priority of the issue Low,Medium,High or Critical
type PriorityType struct {
	Name string `json:"name"`
}

// Fields placeholder for the issue information
type Fields struct {
	Project     Project      `json:"project"`
	Summary     string       `json:"summary"`
	Description string       `json:"description"`
	Issuetype   Issuetype    `json:"issuetype"`
	Priority    PriorityType `json:"priority"`
}
