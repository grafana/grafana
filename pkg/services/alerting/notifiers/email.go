package notifiers

import (
	"os"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "email",
		Name:        "Email",
		Description: "Sends notifications using Grafana server configured SMTP settings",
		Factory:     NewEmailNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">Email addresses</h3>
      <div class="gf-form">
         <textarea rows="7" class="gf-form-input width-27" required ng-model="ctrl.model.settings.addresses"></textarea>
      </div>
      <div class="gf-form">
      <span>You can enter multiple email addresses using a ";" separator</span>
      </div>
    `,
	})
}

type EmailNotifier struct {
	NotifierBase
	Addresses []string
	log       log.Logger
}

func NewEmailNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	addressesString := model.Settings.Get("addresses").MustString()

	if addressesString == "" {
		return nil, alerting.ValidationError{Reason: "Could not find addresses in settings"}
	}

	// split addresses with a few different ways
	addresses := strings.FieldsFunc(addressesString, func(r rune) bool {
		switch r {
		case ',', ';', '\n':
			return true
		}
		return false
	})

	return &EmailNotifier{
		NotifierBase: NewNotifierBase(model),
		Addresses:    addresses,
		log:          log.New("alerting.notifier.email"),
	}, nil
}

func (this *EmailNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Sending alert notification to", "addresses", this.Addresses)

	ruleUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed get rule link", "error", err)
		return err
	}

	error := ""
	if evalContext.Error != nil {
		error = evalContext.Error.Error()
	}

	cmd := &m.SendEmailCommandSync{
		SendEmailCommand: m.SendEmailCommand{
			Subject: evalContext.GetNotificationTitle(),
			Data: map[string]interface{}{
				"Title":         evalContext.GetNotificationTitle(),
				"State":         evalContext.Rule.State,
				"Name":          evalContext.Rule.Name,
				"StateModel":    evalContext.GetStateModel(),
				"Message":       evalContext.Rule.Message,
				"Error":         error,
				"RuleUrl":       ruleUrl,
				"ImageLink":     "",
				"EmbeddedImage": "",
				"AlertPageUrl":  setting.AppUrl + "alerting",
				"EvalMatches":   evalContext.EvalMatches,
			},
			To:           this.Addresses,
			Template:     "alert_notification.html",
			EmbededFiles: []string{},
		},
	}

	if evalContext.ImagePublicUrl != "" {
		cmd.Data["ImageLink"] = evalContext.ImagePublicUrl
	} else {
		file, err := os.Stat(evalContext.ImageOnDiskPath)
		if err == nil {
			cmd.EmbededFiles = []string{evalContext.ImageOnDiskPath}
			cmd.Data["EmbeddedImage"] = file.Name()
		}
	}

	err = bus.DispatchCtx(evalContext.Ctx, cmd)

	if err != nil {
		this.log.Error("Failed to send alert notification email", "error", err)
		return err
	}
	return nil

}
