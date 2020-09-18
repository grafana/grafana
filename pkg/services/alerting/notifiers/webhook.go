package notifiers

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
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
func NewWebHookNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	password := model.DecryptedValue("password", model.Settings.Get("password").MustString())

	return &WebhookNotifier{
		NotifierBase: NewNotifierBase(model),
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

// Notify send alert notifications as
// webhook as http requests.
func (wn *WebhookNotifier) Notify(evalContext *alerting.EvalContext) error {
	wn.log.Info("Sending webhook")

	bodyJSON := simplejson.New()
	bodyJSON.Set("title", evalContext.GetNotificationTitle())
	bodyJSON.Set("ruleId", evalContext.Rule.ID)
	bodyJSON.Set("ruleName", evalContext.Rule.Name)
	bodyJSON.Set("state", evalContext.Rule.State)
	bodyJSON.Set("evalMatches", evalContext.EvalMatches)
	bodyJSON.Set("orgId", evalContext.Rule.OrgID)
	bodyJSON.Set("dashboardId", evalContext.Rule.DashboardID)
	bodyJSON.Set("panelId", evalContext.Rule.PanelID)

	tags := make(map[string]string)

	for _, tag := range evalContext.Rule.AlertRuleTags {
		tags[tag.Key] = tag.Value
	}

	bodyJSON.Set("tags", tags)

	ruleURL, err := evalContext.GetRuleURL()
	if err == nil {
		bodyJSON.Set("ruleUrl", ruleURL)
	}

	if wn.NeedsImage() && evalContext.ImagePublicURL != "" {
		bodyJSON.Set("imageUrl", evalContext.ImagePublicURL)
	}

	if evalContext.Rule.Message != "" {
		bodyJSON.Set("message", evalContext.Rule.Message)
	}

	body, _ := bodyJSON.MarshalJSON()

	cmd := &models.SendWebhookSync{
		Url:        wn.URL,
		User:       wn.User,
		Password:   wn.Password,
		Body:       string(body),
		HttpMethod: wn.HTTPMethod,
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		wn.log.Error("Failed to send webhook", "error", err, "webhook", wn.Name)
		return err
	}

	return nil
}
