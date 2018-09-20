package notifiers

import (
	"fmt"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/pkg/errors"
	"github.com/sfreiberg/gotwilio"
	"strings"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "twilio",
		Name:        "twilio",
		Description: "Sends an SMS to Twilio for dispatch to a real phone",
		Factory:     NewTwilioNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">Twilio settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-10">Client Id</span>
        <input type="text" required class="gf-form-input max-width-26" ng-model="ctrl.model.settings.clientId" placeholder="Twilio client ID"></input>
        <info-popover mode="right-absolute">
          You will find the client ID in your Twilio Dashboard: https://www.twilio.com/console/sms/dashboard
        </info-popover>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">API Token</span>
          <input type="text" class="gf-form-input max-width-20" ng-model="ctrl.model.settings.apiToken" placeholder="Twilio API Token"></input>
          <info-popover mode="right-absolute">
            You will find the client ID in your Twilio Dashboard: https://www.twilio.com/console/sms/dashboard
          </info-popover>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">Sender phone number</span>
          <input type="text" class="gf-form-input max-width-20" ng-model="ctrl.model.settings.senderNumber" placeholder="Number presented to the recipients"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">Recipient numbers (separated by a comma)</span>
        <input type="text" class="gf-form-input" ng-model="ctrl.model.settings.recipients"></input>
      </div>
      <div class="gf-form">
        <gf-form-switch
           class="gf-form"
           label="Only send if alert is triggered"
           label-class="width-14"
           checked="ctrl.model.settings.sendOnlyFail"
           tooltip="Only send an SMS when the alert starts.">
        </gf-form-switch>
      </div>
      <div class="gf-form">
        <gf-form-switch
           class="gf-form"
           label="Send MMS with picture"
           label-class="width-14"
           checked="ctrl.model.settings.sendMMS"
           tooltip="Sends an MMS with the alert picture">
        </gf-form-switch>
      </div>
    `,
	})

}

func NewTwilioNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	clientId := model.Settings.Get("clientId").MustString()
	if clientId == "" {
		return nil, alerting.ValidationError{Reason: "Could not find clientId property in settings"}
	}

	apiToken := model.Settings.Get("apiToken").MustString()
	if apiToken == "" {
		return nil, alerting.ValidationError{Reason: "Could not find apiToken property in settings"}
	}

	senderNumber := model.Settings.Get("senderNumber").MustString()
	if senderNumber == "" {
		return nil, alerting.ValidationError{Reason: "Could not find senderNumber property in settings"}
	}

	recipientString := model.Settings.Get("recipients").MustString()
	if recipientString == "" {
		return nil, alerting.ValidationError{Reason: "Could not find recipients property in settings"}
	}

	recipients := strings.Split(recipientString, ",")
	for i, r := range recipients {
		recipients[i] = strings.TrimSpace(r)
	}

	return &TwilioNotifier{
		NotifierBase: NewNotifierBase(model),
		ClientId:     clientId,
		ApiToken:     apiToken,
		SenderNumber: senderNumber,
		Recipients:   recipients,
		SendOnlyFail: model.Settings.Get("sendOnlyFail").MustBool(true),
		SendMMS:      model.Settings.Get("sendMMS").MustBool(false),
		log:          log.New("alerting.notifier.twilio"),
	}, nil
}

type TwilioNotifier struct {
	NotifierBase
	ClientId     string
	ApiToken     string
	SenderNumber string
	Recipients   []string
	SendOnlyFail bool
	SendMMS      bool
	log          log.Logger
}

func (notifier *TwilioNotifier) Notify(evalContext *alerting.EvalContext) error {

	if notifier.SendOnlyFail && evalContext.Rule.State != m.AlertStateAlerting {
		notifier.log.Info(fmt.Sprintf("Skipping alert notification because state is %v", evalContext.Rule.State))
		return nil
	}

	twilio := gotwilio.NewTwilioClient(notifier.ClientId, notifier.ApiToken)
	from := notifier.SenderNumber
	message := fmt.Sprintf("%v - %v (%v)", evalContext.GetNotificationTitle(), evalContext.Rule.Message, evalContext.ConditionEvals)

	var errorStrings []string
	for _, recipient := range notifier.Recipients {
		var err error
		if notifier.SendMMS {
			notifier.log.Info(fmt.Sprintf("Sending twilio MMS notification to %v", notifier.SenderNumber))
			_, _, err = twilio.SendMMS(from, recipient, message, evalContext.ImagePublicUrl, "", "")
		} else {
			notifier.log.Info(fmt.Sprintf("Sending twilio SMS notification to %v", notifier.SenderNumber))
			_, _, err = twilio.SendSMS(from, recipient, message, "", "")
		}
		if err != nil {
			notifier.log.Warn(fmt.Sprintf("Failed to send notification to %v: %v", recipient, err))
			errorStrings = append(errorStrings, err.Error())
		}
	}

	if len(errorStrings) != 0 {
		// at least one error occurred, concatenate the error messages and return an error with that message
		return errors.New(strings.Join(errorStrings, ", "))
	}

	return nil
}
