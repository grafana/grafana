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
		OptionsTemplate: `
			<h3 class="page-heading">Webhook settings</h3>
			<div class="gf-form max-width-30">
				<span class="gf-form-label width-8">Url</span>
				<input type="text" required class="gf-form-input max-width-26" ng-model="ctrl.model.settings.url"></input>
			</div>
			<div class="gf-form max-width-30">
				<span class="gf-form-label width-8">Http Method</span>
				<div class="gf-form-select-wrapper max-width-30">
					<select class="gf-form-input" ng-model="ctrl.model.settings.httpMethod" ng-options="t for t in ['POST', 'PUT']">
					</select>
				</div>
			</div>
			<div class="gf-form max-width-30">
				<span class="gf-form-label width-8">Username</span>
				<input type="text" class="gf-form-input max-width-30" ng-model="ctrl.model.settings.username"></input>
			</div>
			<div class="gf-form max-width-30">
				<div class="gf-form gf-form--v-stretch"><label class="gf-form-label width-8">Password</label></div>
				<div class="gf-form gf-form--grow" ng-if="!ctrl.model.secureFields.password">
					<input type="text"
						class="gf-form-input max-width-30"
						ng-init="ctrl.model.secureSettings.password = ctrl.model.settings.password || null; ctrl.model.settings.password = null;"
						ng-model="ctrl.model.secureSettings.password"
						data-placement="right">
					</input>
				</div>
				<div class="gf-form" ng-if="ctrl.model.secureFields.password">
					<input type="text" class="gf-form-input max-width-18" disabled="disabled" value="configured" />
					<a class="btn btn-secondary gf-form-btn" href="#" ng-click="ctrl.model.secureFields.password = false">reset</a>
				</div>
			</div>
    `,
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
