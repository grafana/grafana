package alerting

import (
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting/alertstates"
	"github.com/grafana/grafana/pkg/setting"
)

type NotifierImpl struct {
	log              log.Logger
	getNotifications func(orgId int64, notificationGroups []int64) []*Notification
}

func NewNotifier() *NotifierImpl {
	log := log.New("alerting.notifier")
	return &NotifierImpl{
		log:              log,
		getNotifications: buildGetNotifiers(log),
	}
}

func (n NotifierImpl) ShouldDispath(alertResult *AlertResult, notifier *Notification) bool {
	warn := alertResult.State == alertstates.Warn && notifier.SendWarning
	crit := alertResult.State == alertstates.Critical && notifier.SendCritical
	return (warn || crit) || alertResult.State == alertstates.Ok
}

func (n *NotifierImpl) Notify(alertResult *AlertResult) {
	notifiers := n.getNotifications(alertResult.AlertJob.Rule.OrgId, alertResult.AlertJob.Rule.NotificationGroups)

	for _, notifier := range notifiers {
		if n.ShouldDispath(alertResult, notifier) {
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
	grafanaUrl := fmt.Sprintf("%s:%s", setting.HttpAddr, setting.HttpPort)
	if setting.AppSubUrl != "" {
		grafanaUrl += "/" + setting.AppSubUrl
	}

	cmd := &m.SendEmailCommand{
		Data: map[string]interface{}{
			"Name":            "Name",
			"State":           alertResult.State,
			"Description":     alertResult.Description,
			"TriggeredAlerts": alertResult.TriggeredAlerts,
			"DashboardLink":   grafanaUrl + "/dashboard/db/alerting",
			"AlertPageUrl":    grafanaUrl + "/alerting",
			"DashboardImage":  grafanaUrl + "/render/dashboard-solo/db/alerting?from=1466169458375&to=1466171258375&panelId=1&width=1000&height=500",
		},
		To:       []string{this.To},
		Template: "alert_notification.html",
	}

	err := bus.Dispatch(cmd)
	if err != nil {
		this.log.Error("Could not send alert notification as email", "error", err)
	}
}

type WebhookNotifier struct {
	Url      string
	User     string
	Password string
	log      log.Logger
}

func (this *WebhookNotifier) Dispatch(alertResult *AlertResult) {
	this.log.Info("Sending webhook")

	bodyJSON := simplejson.New()
	bodyJSON.Set("name", alertResult.AlertJob.Rule.Name)
	bodyJSON.Set("state", alertResult.State)
	bodyJSON.Set("trigged", alertResult.TriggeredAlerts)

	body, _ := bodyJSON.MarshalJSON()

	cmd := &m.SendWebhook{
		Url:      this.Url,
		User:     this.User,
		Password: this.Password,
		Body:     string(body),
	}

	bus.Dispatch(cmd)
}

type NotificationDispatcher interface {
	Dispatch(alertResult *AlertResult)
}

func buildGetNotifiers(log log.Logger) func(orgId int64, notificationGroups []int64) []*Notification {
	return func(orgId int64, notificationGroups []int64) []*Notification {
		query := &m.GetAlertNotificationQuery{
			OrgID:                orgId,
			Ids:                  notificationGroups,
			IncludeAlwaysExecute: true,
		}
		err := bus.Dispatch(query)
		if err != nil {
			log.Error("Failed to read notifications", "error", err)
		}

		var result []*Notification
		log.Info("notifiriring", "count", len(query.Result), "groups", notificationGroups)
		for _, notification := range query.Result {
			not, err := NewNotificationFromDBModel(notification)
			if err == nil {
				result = append(result, not)
			} else {
				log.Error("Failed to read notification model", "error", err)
			}
		}

		return result
	}
}

func NewNotificationFromDBModel(model *m.AlertNotification) (*Notification, error) {
	notifier, err := createNotifier(model.Type, model.Settings)

	if err != nil {
		return nil, err
	}

	return &Notification{
		Name:         model.Name,
		Type:         model.Type,
		Notifierr:    notifier,
		SendCritical: model.Settings.Get("sendCrit").MustBool(),
		SendWarning:  model.Settings.Get("sendWarn").MustBool(),
	}, nil
}

var createNotifier = func(notificationType string, settings *simplejson.Json) (NotificationDispatcher, error) {
	if notificationType == "email" {
		to := settings.Get("to").MustString()

		if to == "" {
			return nil, fmt.Errorf("Could not find to propertie in settings")
		}

		return &EmailNotifier{
			To:  to,
			log: log.New("alerting.notification.email"),
		}, nil
	}

	url := settings.Get("url").MustString()
	if url == "" {
		return nil, fmt.Errorf("Could not find url propertie in settings")
	}

	return &WebhookNotifier{
		Url:      url,
		User:     settings.Get("user").MustString(),
		Password: settings.Get("password").MustString(),
		log:      log.New("alerting.notification.webhook"),
	}, nil
}
