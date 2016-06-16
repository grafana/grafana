package alerting

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting/alertstates"
)

type NotifierImpl struct {
	log log.Logger
}

func NewNotifier() *NotifierImpl {
	return &NotifierImpl{
		log: log.New("alerting.notifier"),
	}
}

func (n *NotifierImpl) Notify(alertResult *AlertResult) {
	notifiers := n.getNotifiers(alertResult.AlertJob.Rule.OrgId, []int64{1, 2})

	for _, notifier := range notifiers {
		warn := alertResult.State == alertstates.Warn && notifier.SendWarning
		crit := alertResult.State == alertstates.Critical && notifier.SendCritical
		if warn || crit {
			n.log.Info("Sending notification", "state", alertResult.State, "type", notifier.Type)
			go notifier.Notifierr.Dispatch(alertResult)
		}
	}

}

type Notification struct {
	Name         string
	Type         string
	SendWarning  bool
	SendCritical bool

	Notifierr NotificationDispatcher
}

type EmailNotifier struct {
	To  string
	log log.Logger
}

func (this *EmailNotifier) Dispatch(alertResult *AlertResult) {
	this.log.Info("Sending email")
	cmd := &m.SendEmailCommand{
		Data: map[string]interface{}{
			"Description":     alertResult.Description,
			"TriggeredAlerts": alertResult.TriggeredAlerts,
		},
		To:       []string{this.To},
		Info:     "Alert result",
		Massive:  false,
		Template: "",
	}

	bus.Dispatch(cmd)
}

type WebhookNotifier struct {
	Url      string
	User     string
	Password string
	log      log.Logger
}

func (this *WebhookNotifier) Dispatch(alertResult *AlertResult) {
	this.log.Info("Sending webhook")
	cmd := &m.SendWebhook{
		Url:      this.Url,
		User:     this.User,
		Password: this.Password,
		Body:     alertResult.Description,
	}

	bus.Dispatch(cmd)
}

type NotificationDispatcher interface {
	Dispatch(alertResult *AlertResult)
}

func (n *NotifierImpl) getNotifiers(orgId int64, notificationGroups []int64) []*Notification {
	query := &m.GetAlertNotificationQuery{
		OrgID: orgId,
		Ids:   notificationGroups,
	}
	err := bus.Dispatch(query)
	if err != nil {
		n.log.Error("Failed to read notifications", "error", err)
	}

	var result []*Notification

	for _, notification := range query.Result {
		not, err := NewNotificationFromDBModel(notification)
		if err == nil {
			result = append(result, not)
		}
	}

	return result
}

func NewNotificationFromDBModel(model *m.AlertNotification) (*Notification, error) {
	return &Notification{
		Name:         model.Name,
		Type:         model.Type,
		Notifierr:    createNotifier(model.Type, model.Settings),
		SendCritical: !model.Settings.Get("ignoreCrit").MustBool(),
		SendWarning:  !model.Settings.Get("ignoreWarn").MustBool(),
	}, nil
}

var createNotifier = func(notificationType string, settings *simplejson.Json) NotificationDispatcher {
	if notificationType == "email" {
		return &EmailNotifier{
			To:  settings.Get("to").MustString(),
			log: log.New("alerting.notification.email"),
		}
	}

	return &WebhookNotifier{
		Url:      settings.Get("url").MustString(),
		User:     settings.Get("user").MustString(),
		Password: settings.Get("password").MustString(),
		log:      log.New("alerting.notification.webhook"),
	}
}
