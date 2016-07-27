package alerting

import (
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

type RootNotifier struct {
	log log.Logger
}

func NewRootNotifier() *RootNotifier {
	return &RootNotifier{
		log: log.New("alerting.notifier"),
	}
}

func (n *RootNotifier) GetType() string {
	return "root"
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
		if not, err := n.getNotifierFor(notification); err != nil {
			return nil, err
		} else {
			result = append(result, not)
		}
	}

	return result, nil
}

func (n *RootNotifier) getNotifierFor(model *m.AlertNotification) (Notifier, error) {
	factory, found := notifierFactories[model.Type]
	if !found {
		return nil, errors.New("Unsupported notification type")
	}

	return factory(model)
	// if model.Type == "email" {
	// 	addressesString := model.Settings.Get("addresses").MustString()
	//
	// 	if addressesString == "" {
	// 		return nil, fmt.Errorf("Could not find addresses in settings")
	// 	}
	//
	// 		NotifierBase: NotifierBase{
	// 			Name: model.Name,
	// 			Type: model.Type,
	// 		},
	// 		Addresses: strings.Split(addressesString, "\n"),
	// 		log:       log.New("alerting.notification.email"),
	// 	}, nil
	// }

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

type NotifierFactory func(notification *m.AlertNotification) (Notifier, error)

var notifierFactories map[string]NotifierFactory = make(map[string]NotifierFactory)

func RegisterNotifier(typeName string, factory NotifierFactory) {
	notifierFactories[typeName] = factory
}
