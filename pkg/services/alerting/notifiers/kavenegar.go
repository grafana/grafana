package notifiers

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

const (
	apiURL = "https://api.kavenegar.com/v1/%s/sms/send.json"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "kavenegar",
		Name:        "Kavenegar",
		Description: "Send SMS notifications using Kavenegar",
		Factory:     NewKavenegarNotifier,
		OptionsTemplate: `
		<div class="gf-form-group">
			<h3 class="page-heading">Kavenegar notifications settings</h3>
			<div class="gf-form">
				<span class="gf-form-label width-14">API Key</span>
				<input type="text" required class="gf-form-input max-width-26" ng-model="ctrl.model.settings.apikey" placeholder="Kavenegar API key"></input>
			</div>
			<div class="gf-form">
				<span class="gf-form-label width-14">Sender number</span>
				<input type="text" class="gf-form-input max-width-26" ng-model="ctrl.model.settings.sender" placeholder="Optional"></input>
			</div>
			<div class="gf-form">
				<span class="gf-form-label width-14">Recipients</span>
				<input type="text" required class="gf-form-input max-width-40" ng-model="ctrl.model.settings.recipients" placeholder="0912...;0935..."></input>
			</div>
			<div class="gf-form">
				<span>You can enter multiple phones using a ";" separator</span>
			</div>
			<div class="gf-form">
				<span class="gf-form-label width-6">Content</span>
				<textarea rows="7" class="gf-form-input width-27" required ng-model="ctrl.model.settings.template"></textarea>
			</div>
			<div class="gf-form">
				<span>You can use the following placeholders: {RULE_NAME}, {RULE_MESSAGE}, {RULE_STATE}</span>
			</div>
		</div>
    `,
	})

}

// NewKavenegarNotifier is the constructor for
// the Kavenegar notifier.
func NewKavenegarNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	apiKey := model.Settings.Get("apikey").MustString()
	if apiKey == "" {
		return nil, alerting.ValidationError{Reason: "Could not find apikey property in settings"}
	}

	template := model.Settings.Get("template").MustString()
	if template == "" {
		return nil, alerting.ValidationError{Reason: "Could not find template property in settings"}
	}

	recips := model.Settings.Get("recipients").MustString()
	if recips == "" {
		return nil, alerting.ValidationError{Reason: "Could not find recipients property in settings"}
	}

	sender, _ := model.Settings.Get("sender").String()

	return &KavenegarNotifier{
		NotifierBase: NewNotifierBase(model),
		APIKey:       apiKey,
		Body:         template,
		Recipients:   strings.Split(recips, ";"),
		Sender:       sender,
		log:          log.New("alerting.notifier.kavenegar"),
	}, nil
}

// KavenegarNotifier is the struct to hold the data for Kavenegar
type KavenegarNotifier struct {
	NotifierBase
	APIKey     string
	Recipients []string
	Body       string
	Sender     string
	log        log.Logger
}

// Notify is the method to dispatch the Kavenegar API call
func (sn *KavenegarNotifier) Notify(evalContext *alerting.EvalContext) error {
	sn.log.Info("Initiating Kavenegar notification for")

	form := url.Values{}

	form.Add("receptor", strings.Join(sn.Recipients, ","))

	template := sn.Body
	template = strings.Replace(template, "{RULE_NAME}", evalContext.Rule.Name, 1)
	template = strings.Replace(template, "{RULE_MESSAGE}", evalContext.Rule.Message, 1)
	template = strings.Replace(template, "{RULE_STATE}", string(evalContext.Rule.State), 1)

	form.Add("message", template)

	if sn.Sender != "" {
		form.Add("sender", sn.Sender)
	}

	formBody := form.Encode()

	cmd := &models.SendWebhookSync{
		Url:        fmt.Sprintf("%s?%s", fmt.Sprintf(apiURL, sn.APIKey), formBody),
		HttpMethod: "GET",
		Body:       "",
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		sn.log.Error("Failed to send notification to Kavenegar", "error", err, "body", formBody)
		return err
	}

	return nil
}
