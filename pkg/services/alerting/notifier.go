package alerting

import (
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/imguploader"
	"github.com/grafana/grafana/pkg/components/renderer"
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

func (n *RootNotifier) NeedsImage() bool {
	return false
}

func (n *RootNotifier) PassesFilter(rule *Rule) bool {
	return false
}

func (n *RootNotifier) Notify(context *EvalContext) {
	n.log.Info("Sending notifications for", "ruleId", context.Rule.Id)

	notifiers, err := n.getNotifiers(context.Rule.OrgId, context.Rule.Notifications, context)
	if err != nil {
		n.log.Error("Failed to read notifications", "error", err)
		return
	}

	if len(notifiers) == 0 {
		return
	}

	err = n.uploadImage(context)
	if err != nil {
		n.log.Error("Failed to upload alert panel image", "error", err)
	}

	n.sendNotifications(notifiers, context)
}

func (n *RootNotifier) sendNotifications(notifiers []Notifier, context *EvalContext) {
	for _, notifier := range notifiers {
		n.log.Info("Sending notification", "firing", context.Firing, "type", notifier.GetType())
		go notifier.Notify(context)
	}
}

func (n *RootNotifier) uploadImage(context *EvalContext) error {
	uploader, _ := imguploader.NewImageUploader()

	imageUrl, err := context.GetImageUrl()
	if err != nil {
		return err
	}

	renderOpts := &renderer.RenderOpts{
		Url:       imageUrl,
		Width:     "800",
		Height:    "400",
		SessionId: "cef0256d482b4293",
		Timeout:   "30",
	}

	if imagePath, err := renderer.RenderToPng(renderOpts); err != nil {
		return err
	} else {
		context.ImageOnDiskPath = imagePath
	}

	context.ImagePublicUrl, err = uploader.Upload(context.ImageOnDiskPath)
	if err != nil {
		return err
	}

	n.log.Info("uploaded", "url", context.ImagePublicUrl)
	return nil
}

func (n *RootNotifier) getNotifiers(orgId int64, notificationIds []int64, context *EvalContext) ([]Notifier, error) {
	query := &m.GetAlertNotificationsToSendQuery{OrgId: orgId, Ids: notificationIds}

	if err := bus.Dispatch(query); err != nil {
		return nil, err
	}

	var result []Notifier
	for _, notification := range query.Result {
		if not, err := n.createNotifierFor(notification); err != nil {
			return nil, err
		} else {
			if shouldUseNotification(not, context) {
				result = append(result, not)
			}
		}
	}

	return result, nil
}

func (n *RootNotifier) createNotifierFor(model *m.AlertNotification) (Notifier, error) {
	factory, found := notifierFactories[model.Type]
	if !found {
		return nil, errors.New("Unsupported notification type")
	}

	return factory(model)
}

func shouldUseNotification(notifier Notifier, context *EvalContext) bool {
	if !context.Firing {
		return true
	}

	if context.Error != nil {
		return true
	}

	return notifier.PassesFilter(context.Rule)
}

type NotifierFactory func(notification *m.AlertNotification) (Notifier, error)

var notifierFactories map[string]NotifierFactory = make(map[string]NotifierFactory)

func RegisterNotifier(typeName string, factory NotifierFactory) {
	notifierFactories[typeName] = factory
}
