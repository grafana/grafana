package notifiers

import (
	"fmt"
	"net/url"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

const (
	messageLengthLimit = 300
)

var (
	kavenegarAPIURL = "https://api.kavenegar.com/v1/%s/%s"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "kavenegar",
		Name:        "Kevenegar",
		Description: "Sends a message or call the recipient",
		Heading:     "Kavenegar settings",
		Factory:     NewKavenegarNotifier,
		Options: []alerting.NotifierOption{
			{
				Label:   "Method",
				Element: alerting.ElementTypeSelect,
				SelectOptions: []alerting.SelectOption{
					{
						Value: "message",
						Label: "Message",
					},
					{
						Value: "call",
						Label: "Call",
					},
				},
				Description:  "Notification method. call or message",
				PropertyName: "method",
			},
			{
				Label:        "Recipient",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "One or more recipients' phone numbers (comma separated). Phone numbers shoud be like 989120000000",
				PropertyName: "recipient",
			},
			{
				Label:        "Token",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "Kavenegar token to use the API",
				PropertyName: "token",
				Secure:       true,
			},
		},
	})
}

// NewKavenegarNotifier is the constructor for the Kavenegar Notifier.
func NewKavenegarNotifier(model *models.AlertNotification) (alerting.Notifier, error) {

	token := model.DecryptedValue("token", model.Settings.Get("token").MustString())
	recipient := model.Settings.Get("recipient").MustString()

	if token == "" {
		return nil, alerting.ValidationError{Reason: "Could not find token property in settings"}
	}

	if recipient == "" {
		return nil, alerting.ValidationError{Reason: "Could not find recipient property in settings"}
	}

	return &KavenegarNotifier{
		NotifierBase: NewNotifierBase(model),
		Token:        token,
		Recipient:    recipient,
		Method:       model.Settings.Get("method").MustString(),
		log:          log.New("alerting.notifier.kavenegar"),
	}, nil
}

// KavenegarNotifier is responsible for sending
// alert notifications to Kavenegar.
type KavenegarNotifier struct {
	NotifierBase
	Token     string
	Recipient string
	Method    string
	log       log.Logger
}

// Notify send alert notification to Kavenegar
func (kn *KavenegarNotifier) Notify(evalContext *alerting.EvalContext) error {
	kn.log.Info("Executing Kavenegar notification", "ruleId", evalContext.Rule.ID, "notification", kn.Name)

	ruleURL, err := evalContext.GetRuleURL()
	if err != nil {
		kn.log.Error("Failed get rule link", "error", err)
		return err
	}

	msg := fmt.Sprintf("%s - %s\n%s", evalContext.GetNotificationTitle(), ruleURL, evalContext.Rule.Message)

	if len(msg) > messageLengthLimit {
		msg = msg[0:messageLengthLimit]
	}

	msg = url.QueryEscape(msg)

	url := ""
	if kn.Method == "call" {
		url = fmt.Sprintf(kavenegarAPIURL, kn.Token, "call/maketts.json")
	} else {
		url = fmt.Sprintf(kavenegarAPIURL, kn.Token, "sms/send.json")
	}

	url = fmt.Sprintf(
		"%s?message=%s&repeat=5&receptor=%s",
		url,
		msg,
		kn.Recipient,
	)

	cmd := &models.SendWebhookSync{
		Url:        url,
		HttpMethod: "POST",
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		kn.log.Error("Failed to send kavenegar event", "error", err, "kavenegar", kn.Name)
		return err
	}

	return nil
}
