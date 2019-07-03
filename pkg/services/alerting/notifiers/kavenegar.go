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
	apiUrl = "https://api.kavenegar.com/v1/%s/sms/send.json "
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
				<input type="text" required class="gf-form-input max-width-22" ng-model="ctrl.model.settings.apikey" placeholder="Kavenegar API key"></input>
			</div>
			<div class="gf-form">
				<span class="gf-form-label width-14">Sender</span>
				<input type="text" required class="gf-form-input max-width-22" ng-model="ctrl.model.settings.sender" placeholder="Sender number"></input>
			</div>
			<div class="gf-form">
				<textarea rows="7" class="gf-form-input width-27" required ng-model="ctrl.model.settings.recipients"></textarea>
			</div>
			<div class="gf-form">
				<span>You can enter multiple phones using a ";" separator</span>
			</div>
			<div class="gf-form">
				<textarea rows="7" class="gf-form-input width-27" required ng-model="ctrl.model.settings.template"></textarea>
			</div>
		</div>
    `,
	})

}

// NewWebHookNotifier is the constructor for
// the WebHook notifier.
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

	sender := model.Settings.Get("sender").MustString()
	if sender == "" {
		return nil, alerting.ValidationError{Reason: "Could not find sender property in settings"}
	}

	return &KavenegarNotifier{
		NotifierBase: NewNotifierBase(model),
		ApiKey:       apiKey,
		Body:         template,
		Recipients:   strings.Split(";", recips),
		Sender:       sender,
		log:          log.New("alerting.notifier.kavenegar"),
	}, nil
}

type KavenegarNotifier struct {
	NotifierBase
	ApiKey     string
	Recipients []string
	Body       string
	Sender     string
	log        log.Logger
}

func (sn *KavenegarNotifier) Notify(evalContext *alerting.EvalContext) error {
	sn.log.Info("Initiating Kavenegar notification")

	form := url.Values{}

	form.Add("receptor", strings.Join(sn.Recipients, ","))
	form.Add("message", sn.Body)

	if sn.Sender != "" {
		form.Add("sender", sn.Sender)
	}

	formBody := form.Encode()

	cmd := &models.SendWebhookSync{
		Url:        fmt.Sprintf(apiUrl, sn.ApiKey),
		HttpMethod: "POST",
		Body:       formBody,
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		sn.log.Error("Failed to send notification to Kavenegar", "error", err, "body", formBody)
		return err
	}

	return nil
}
