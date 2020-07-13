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
    <div class="gf-form-group">
      <h3 class="page-heading">LINE notify settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-14">Token</span>
        <input type="text" required class="gf-form-input max-width-22" ng-model="ctrl.model.settings.token" placeholder="LINE notify token key"></input>
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
	token := model.Settings.Get("token").MustString()
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

	var err error
	switch evalContext.Rule.State {
	case models.AlertStateAlerting:
		err = ln.createAlert(evalContext)
	}
	return err
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
