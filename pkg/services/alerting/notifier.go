package alerting

import (
	"fmt"
	"log"
	"strconv"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
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

func (n *NotifierImpl) Notify(alertResult *AlertResultContext) {
	notifiers := n.getNotifications(alertResult.Rule.OrgId, alertResult.Rule.Notifications)

	for _, notifier := range notifiers {
		n.log.Info("Sending notification", "state", alertResult.State, "type", notifier.Type)
		go notifier.Notifierr.Dispatch(alertResult)
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

	query := &m.GetDashboardsQuery{
		DashboardIds: []int64{alertResult.AlertJob.Rule.DashboardId},
	}

	if err := bus.Dispatch(query); err != nil {
		this.log.Error("Failed to load dashboard", "error", err)
		return
	}

	if len(query.Result) != 1 {
		this.log.Error("Can only support one dashboard", "result", len(query.Result))
		return
	}

	dashboard := query.Result[0]

	panelId := strconv.Itoa(int(alertResult.AlertJob.Rule.PanelId))

	//TODO: get from alertrule and transforms to seconds
	from := "1466169458375"
	to := "1466171258375"

	renderUrl := fmt.Sprintf("%s/render/dashboard-solo/db/%s?from=%s&to=%s&panelId=%s&width=1000&height=500", grafanaUrl, dashboard.Slug, from, to, panelId)
	cmd := &m.SendEmailCommand{
		Data: map[string]interface{}{
			"Name":            "Name",
			"State":           alertResult.State,
			"Description":     alertResult.Description,
			"TriggeredAlerts": alertResult.TriggeredAlerts,
			"DashboardLink":   grafanaUrl + "/dashboard/db/" + dashboard.Slug,
			"AlertPageUrl":    grafanaUrl + "/alerting",
			"DashboardImage":  renderUrl,
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

func (this *WebhookNotifier) Dispatch(alertResult *AlertResultContext) {
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
