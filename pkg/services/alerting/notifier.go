package alerting

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting/alertstates"
)

type Notifier struct {
	log log.Logger
}

func NewNotifier() *Notifier {
	return &Notifier{
		log: log.New("alerting.notifier"),
	}
}

func (n *Notifier) Notify(alertResult AlertResult) {
	notifiers := getNotifiers(alertResult.AlertJob.Rule.OrgId, alertResult.AlertJob.Rule.NotificationGroups)

	for _, notifier := range notifiers {
		warn := alertResult.State == alertstates.Warn && notifier.SendWarning
		crit := alertResult.State == alertstates.Critical && notifier.SendCritical

		if warn || crit {
			n.log.Info("Sending notification", "state", alertResult.State, "type", notifier.Type)
			go notifier.Notifierr.Notify(alertResult)
		}
	}

}

type Notification struct {
	Name         string
	Type         string
	SendWarning  bool
	SendCritical bool

	Notifierr Notifierr
}

type EmailNotifier struct {
	To   string
	From string
}

func (this EmailNotifier) Notify(alertResult AlertResult) {
	//bus.dispath to notification package in grafana
}

type WebhookNotifier struct {
	Url          string
	AuthUser     string
	AuthPassword string
}

func (this WebhookNotifier) Notify(alertResult AlertResult) {
	//bus.dispath to notification package in grafana
}

type Notifierr interface {
	Notify(alertResult AlertResult)
}

func getNotifiers(orgId int64, notificationGroups []int64) []*Notification {
	var notifications []*m.AlertNotification

	for _, notificationId := range notificationGroups {
		query := m.GetAlertNotificationQuery{
			OrgID: orgId,
			Id:    notificationId,
		}

		notifications = append(notifications, query.Result...)
	}

	var result []*Notification

	for _, notification := range notifications {
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

var createNotifier = func(notificationType string, settings *simplejson.Json) Notifierr {
	if notificationType == "email" {
		return &EmailNotifier{
			To:   settings.Get("to").MustString(),
			From: settings.Get("from").MustString(),
		}
	}

	return &WebhookNotifier{
		Url:          settings.Get("url").MustString(),
		AuthUser:     settings.Get("user").MustString(),
		AuthPassword: settings.Get("password").MustString(),
	}
}
