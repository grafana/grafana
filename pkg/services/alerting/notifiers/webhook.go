package notifiers

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "webhook",
		Name:        "webhook",
		Description: "Sends HTTP POST request to a URL",
		Heading:     "Webhook settings",
		Factory:     NewWebHookNotifier,
		Options: []alerting.NotifierOption{
			{
				Label:        "Url",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				PropertyName: "url",
				Required:     true,
			},
			{
				Label:   "Http Method",
				Element: alerting.ElementTypeSelect,
				SelectOptions: []alerting.SelectOption{
					{
						Value: "POST",
						Label: "POST",
					},
					{
						Value: "PUT",
						Label: "PUT",
					},
				},
				PropertyName: "httpMethod",
			},
			{
				Label:        "Username",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				PropertyName: "username",
			},
			{
				Label:        "Password",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypePassword,
				PropertyName: "password",
				Secure:       true,
			},
		},
	})
}

// NewWebHookNotifier is the constructor for
// the WebHook notifier.
func NewWebHookNotifier(model *models.AlertNotification, fn alerting.GetDecryptedValueFn, ns notifications.Service) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	password := fn(context.Background(), model.SecureSettings, "password", model.Settings.Get("password").MustString(), setting.SecretKey)

	return &WebhookNotifier{
		NotifierBase: NewNotifierBase(model, ns),
		URL:          url,
		User:         model.Settings.Get("username").MustString(),
		Password:     password,
		HTTPMethod:   model.Settings.Get("httpMethod").MustString("POST"),
		log:          log.New("alerting.notifier.webhook"),
	}, nil
}

// WebhookNotifier is responsible for sending
// alert notifications as webhooks.
type WebhookNotifier struct {
	NotifierBase
	URL        string
	User       string
	Password   string
	HTTPMethod string
	log        log.Logger
}

// WebhookNotifierBody is the body of webhook
// notification channel
type WebhookNotifierBody struct {
	Title       string                `json:"title"`
	RuleID      int64                 `json:"ruleId"`
	RuleName    string                `json:"ruleName"`
	State       models.AlertStateType `json:"state"`
	EvalMatches []*alerting.EvalMatch `json:"evalMatches"`
	OrgID       int64                 `json:"orgId"`
	DashboardID int64                 `json:"dashboardId"`
	PanelID     int64                 `json:"panelId"`
	Tags        map[string]string     `json:"tags"`
	RuleURL     string                `json:"ruleUrl,omitempty"`
	ImageURL    string                `json:"imageUrl,omitempty"`
	Message     string                `json:"message,omitempty"`
}

// Notify send alert notifications as
// webhook as http requests.
func (wn *WebhookNotifier) Notify(evalContext *alerting.EvalContext) error {
	wn.log.Info("Sending webhook")

	body := WebhookNotifierBody{
		Title:       evalContext.GetNotificationTitle(),
		RuleID:      evalContext.Rule.ID,
		RuleName:    evalContext.Rule.Name,
		State:       evalContext.Rule.State,
		EvalMatches: evalContext.EvalMatches,
		OrgID:       evalContext.Rule.OrgID,
		DashboardID: evalContext.Rule.DashboardID,
		PanelID:     evalContext.Rule.PanelID,
	}

	tags := make(map[string]string)

	for _, tag := range evalContext.Rule.AlertRuleTags {
		tags[tag.Key] = tag.Value
	}

	body.Tags = tags

	ruleURL, err := evalContext.GetRuleURL()
	if err == nil {
		body.RuleURL = ruleURL
	}

	if wn.NeedsImage() && evalContext.ImagePublicURL != "" {
		body.ImageURL = evalContext.ImagePublicURL
	}

	if evalContext.Rule.Message != "" {
		body.Message = evalContext.Rule.Message
	}

	bodyJSON, _ := json.Marshal(body)

	cmd := &notifications.SendWebhookSync{
		Url:        wn.URL,
		User:       wn.User,
		Password:   wn.Password,
		Body:       string(bodyJSON),
		HttpMethod: wn.HTTPMethod,
	}

	if err := wn.NotificationService.SendWebhookSync(evalContext.Ctx, cmd); err != nil {
		wn.log.Error("Failed to send webhook", "error", err, "webhook", wn.Name)
		return err
	}

	return nil
}
