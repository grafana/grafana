package notifiers

import (
	"os"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"

	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "email",
		Name:        "Email",
		Description: "Sends notifications using Grafana server configured SMTP settings",
		Factory:     NewEmailNotifier,
		Heading:     "Email settings",
		OptionsTemplate: `
			<h3 class="page-heading">Email settings</h3>
			<div class="gf-form">
				<gf-form-switch
					class="gf-form"
					label="Single email"
					label-class="width-8"
					checked="ctrl.model.settings.singleEmail"
					tooltip="Send a single email to all recipients">
				</gf-form-switch>
			</div>
			<div class="gf-form">
				<label class="gf-form-label width-8">
					Addresses
				</label>
				<textarea rows="7" class="gf-form-input width-27" required ng-model="ctrl.model.settings.addresses"></textarea>
			</div>
			<div class="gf-form offset-width-8">
				<span>You can enter multiple email addresses using a ";" separator</span>
			</div>
    `,
		Options: []alerting.NotifierOption{
			{
				Label:        "Single email",
				Description:  "Send a single email to all recipients",
				Element:      alerting.ElementTypeSwitch,
				PropertyName: "singleEmail",
			},
			{
				Label:        "Addresses",
				Description:  "You can enter multiple email addresses using a \";\" separator",
				Element:      alerting.ElementTypeTextArea,
				PropertyName: "addresses",
				Required:     true,
			},
		},
	})
}

// EmailNotifier is responsible for sending
// alert notifications over email.
type EmailNotifier struct {
	NotifierBase
	Addresses   []string
	SingleEmail bool
	log         log.Logger
}

// NewEmailNotifier is the constructor function
// for the EmailNotifier.
func NewEmailNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	addressesString := model.Settings.Get("addresses").MustString()
	singleEmail := model.Settings.Get("singleEmail").MustBool(false)

	if addressesString == "" {
		return nil, alerting.ValidationError{Reason: "Could not find addresses in settings"}
	}

	// split addresses with a few different ways
	addresses := util.SplitEmails(addressesString)

	return &EmailNotifier{
		NotifierBase: NewNotifierBase(model),
		Addresses:    addresses,
		SingleEmail:  singleEmail,
		log:          log.New("alerting.notifier.email"),
	}, nil
}

// Notify sends the alert notification.
func (en *EmailNotifier) Notify(evalContext *alerting.EvalContext) error {
	en.log.Info("Sending alert notification to", "addresses", en.Addresses, "singleEmail", en.SingleEmail)

	ruleURL, err := evalContext.GetRuleURL()
	if err != nil {
		en.log.Error("Failed get rule link", "error", err)
		return err
	}

	error := ""
	if evalContext.Error != nil {
		error = evalContext.Error.Error()
	}

	cmd := &models.SendEmailCommandSync{
		SendEmailCommand: models.SendEmailCommand{
			Subject: evalContext.GetNotificationTitle(),
			Data: map[string]interface{}{
				"Title":         evalContext.GetNotificationTitle(),
				"State":         evalContext.Rule.State,
				"Name":          evalContext.Rule.Name,
				"StateModel":    evalContext.GetStateModel(),
				"Message":       evalContext.Rule.Message,
				"Error":         error,
				"RuleUrl":       ruleURL,
				"ImageLink":     "",
				"EmbeddedImage": "",
				"AlertPageUrl":  setting.AppUrl + "alerting",
				"EvalMatches":   evalContext.EvalMatches,
			},
			To:            en.Addresses,
			SingleEmail:   en.SingleEmail,
			Template:      "alert_notification.html",
			EmbeddedFiles: []string{},
		},
	}

	if en.NeedsImage() {
		if evalContext.ImagePublicURL != "" {
			cmd.Data["ImageLink"] = evalContext.ImagePublicURL
		} else {
			file, err := os.Stat(evalContext.ImageOnDiskPath)
			if err == nil {
				cmd.EmbeddedFiles = []string{evalContext.ImageOnDiskPath}
				cmd.Data["EmbeddedImage"] = file.Name()
			}
		}
	}

	err = bus.DispatchCtx(evalContext.Ctx, cmd)

	if err != nil {
		en.log.Error("Failed to send alert notification email", "error", err)
		return err
	}

	return nil
}
