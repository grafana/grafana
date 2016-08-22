package notifiers

import (
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	alerting.RegisterNotifier("email", NewEmailNotifier)
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

	return &EmailNotifier{
		NotifierBase: NotifierBase{
			Name: model.Name,
			Type: model.Type,
		},
		Addresses: strings.Split(addressesString, "\n"),
		log:       log.New("alerting.notifier.email"),
	}, nil
}

func (this *EmailNotifier) Notify(context *alerting.EvalContext) {
	this.log.Info("Sending alert notification to", "addresses", this.Addresses)
	metrics.M_Alerting_Notification_Sent_Email.Inc(1)

	ruleUrl, err := context.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed get rule link", "error", err)
		return
	}

	cmd := &m.SendEmailCommand{
		Data: map[string]interface{}{
			"Title":         context.GetNotificationTitle(),
			"State":         context.Rule.State,
			"Name":          context.Rule.Name,
			"Severity":      context.Rule.Severity,
			"SeverityColor": context.GetColor(),
			"Message":       context.Rule.Message,
			"RuleUrl":       ruleUrl,
			"ImageLink":     context.ImagePublicUrl,
			"AlertPageUrl":  setting.AppUrl + "alerting",
			"EvalMatches":   context.EvalMatches,
		},
		To:       this.Addresses,
		Template: "alert_notification.html",
	}

	if err := bus.Dispatch(cmd); err != nil {
		this.log.Error("Failed to send alert notification email", "error", err)
	}
}
