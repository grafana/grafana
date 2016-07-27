package alerting

import (
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

type RootNotifier struct {
	NotifierBase
	log log.Logger
}

func NewRootNotifier() *RootNotifier {
	return &RootNotifier{
		log: log.New("alerting.notifier"),
	}
}

func (n *RootNotifier) Notify(context *AlertResultContext) {
	n.log.Info("Sending notifications for", "ruleId", context.Rule.Id)

	notifiers, err := n.getNotifiers(context.Rule.OrgId, context.Rule.Notifications)
	if err != nil {
		n.log.Error("Failed to read notifications", "error", err)
		return
	}

	for _, notifier := range notifiers {
		n.log.Info("Sending notification", "firing", context.Firing, "type", notifier.GetType())
		go notifier.Notify(context)
	}
}

func (n *RootNotifier) getNotifiers(orgId int64, notificationIds []int64) ([]Notifier, error) {
	query := &m.GetAlertNotificationsQuery{OrgId: orgId, Ids: notificationIds}

	if err := bus.Dispatch(query); err != nil {
		return nil, err
	}

	var result []Notifier
	for _, notification := range query.Result {
		if not, err := NewNotificationFromDBModel(notification); err != nil {
			return nil, err
		} else {
			result = append(result, not)
		}
	}

	return result, nil
}

type NotifierBase struct {
	Name string
	Type string
}

func (n *NotifierBase) GetType() string {
	return n.Type
}

type EmailNotifier struct {
	NotifierBase
	Addresses []string
	log       log.Logger
}

func (this *EmailNotifier) Notify(context *AlertResultContext) {
	this.log.Info("Sending alert notification to", "addresses", this.Addresses)

	slugQuery := &m.GetDashboardSlugByIdQuery{Id: context.Rule.DashboardId}
	if err := bus.Dispatch(slugQuery); err != nil {
		this.log.Error("Failed to load dashboard", "error", err)
		return
	}

	ruleLink := fmt.Sprintf("%sdashboard/db/%s?fullscreen&edit&tab=alert&panelId=%d", setting.AppUrl, slugQuery.Result, context.Rule.PanelId)

	cmd := &m.SendEmailCommand{
		Data: map[string]interface{}{
			"RuleState": context.Rule.State,
			"RuleName":  context.Rule.Name,
			"Severity":  context.Rule.Severity,
			"RuleLink":  ruleLink,
		},
		To:       this.Addresses,
		Template: "alert_notification.html",
	}

	err := bus.Dispatch(cmd)
	if err != nil {
		this.log.Error("Failed to send alert notification email", "error", err)
	}
}

// type WebhookNotifier struct {
// 	Url      string
// 	User     string
// 	Password string
// 	log      log.Logger
// }
//
// func (this *WebhookNotifier) Dispatch(context *AlertResultContext) {
// 	this.log.Info("Sending webhook")
//
// 	bodyJSON := simplejson.New()
// 	bodyJSON.Set("name", context.AlertJob.Rule.Name)
// 	bodyJSON.Set("state", context.State)
// 	bodyJSON.Set("trigged", context.TriggeredAlerts)
//
// 	body, _ := bodyJSON.MarshalJSON()
//
// 	cmd := &m.SendWebhook{
// 		Url:      this.Url,
// 		User:     this.User,
// 		Password: this.Password,
// 		Body:     string(body),
// 	}
//
// 	bus.Dispatch(cmd)
// }

func NewNotificationFromDBModel(model *m.AlertNotification) (Notifier, error) {
	if model.Type == "email" {
		addressesString := model.Settings.Get("addresses").MustString()

		if addressesString == "" {
			return nil, fmt.Errorf("Could not find addresses in settings")
		}

		return &EmailNotifier{
			NotifierBase: NotifierBase{
				Name: model.Name,
				Type: model.Type,
			},
			Addresses: strings.Split(addressesString, "\n"),
			log:       log.New("alerting.notification.email"),
		}, nil
	}

	return nil, errors.New("Unsupported notification type")

	// url := settings.Get("url").MustString()
	// if url == "" {
	// 	return nil, fmt.Errorf("Could not find url propertie in settings")
	// }
	//
	// return &WebhookNotifier{
	// 	Url:      url,
	// 	User:     settings.Get("user").MustString(),
	// 	Password: settings.Get("password").MustString(),
	// 	log:      log.New("alerting.notification.webhook"),
	// }, nil
}
