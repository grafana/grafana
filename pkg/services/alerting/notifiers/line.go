package notifiers

import (
	"fmt"
	"net/url"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "LINE",
		Name:        "LINE",
		Description: "Send notifications to LINE notify",
		Heading:     "LINE notify settings",
		Factory:     NewLINENotifier,
		OptionsTemplate: `
		<h3 class="page-heading">LINE notify settings</h3>
		<div class="gf-form">
			<label class="gf-form-label max-width-14">Token</label>
			<div class="gf-form gf-form--grow" ng-if="!ctrl.model.secureFields.token">
				<input type="text"
					required
					class="gf-form-input max-width-22"
					ng-init="ctrl.model.secureSettings.token = ctrl.model.settings.token || null; ctrl.model.settings.token = null;"
					ng-model="ctrl.model.secureSettings.token"
					data-placement="right">
				</input>
			</div>
			<div class="gf-form" ng-if="ctrl.model.secureFields.token">
			  <input type="text" class="gf-form-input max-width-18" disabled="disabled" value="configured" />
			  <a class="btn btn-secondary gf-form-btn" href="#" ng-click="ctrl.model.secureFields.token = false">reset</a>
			</div>
		</div>
`,
		Options: []alerting.NotifierOption{
			{
				Label:        "Token",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "LINE notify token key",
				PropertyName: "token",
				Required:     true,
			}},
	})
}

const (
	lineNotifyURL string = "https://notify-api.line.me/api/notify"
)

// NewLINENotifier is the constructor for the LINE notifier
func NewLINENotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	token := model.DecryptedValue("token", model.Settings.Get("token").MustString())
	if token == "" {
		return nil, alerting.ValidationError{Reason: "Could not find token in settings"}
	}

	return &LineNotifier{
		NotifierBase: NewNotifierBase(model),
		Token:        token,
		log:          log.New("alerting.notifier.line"),
	}, nil
}

// LineNotifier is responsible for sending
// alert notifications to LINE.
type LineNotifier struct {
	NotifierBase
	Token string
	log   log.Logger
}

// Notify send an alert notification to LINE
func (ln *LineNotifier) Notify(evalContext *alerting.EvalContext) error {
	ln.log.Info("Executing line notification", "ruleId", evalContext.Rule.ID, "notification", ln.Name)
	if evalContext.Rule.State == models.AlertStateAlerting {
		return ln.createAlert(evalContext)
	}

	return nil
}

func (ln *LineNotifier) createAlert(evalContext *alerting.EvalContext) error {
	ln.log.Info("Creating Line notify", "ruleId", evalContext.Rule.ID, "notification", ln.Name)
	ruleURL, err := evalContext.GetRuleURL()
	if err != nil {
		ln.log.Error("Failed get rule link", "error", err)
		return err
	}

	form := url.Values{}
	body := fmt.Sprintf("%s - %s\n%s", evalContext.Rule.Name, ruleURL, evalContext.Rule.Message)
	form.Add("message", body)

	if ln.NeedsImage() && evalContext.ImagePublicURL != "" {
		form.Add("imageThumbnail", evalContext.ImagePublicURL)
		form.Add("imageFullsize", evalContext.ImagePublicURL)
	}

	cmd := &models.SendWebhookSync{
		Url:        lineNotifyURL,
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Authorization": fmt.Sprintf("Bearer %s", ln.Token),
			"Content-Type":  "application/x-www-form-urlencoded;charset=UTF-8",
		},
		Body: form.Encode(),
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		ln.log.Error("Failed to send notification to LINE", "error", err, "body", body)
		return err
	}

	return nil
}
