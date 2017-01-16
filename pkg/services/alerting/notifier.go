package alerting

import (
	"errors"
	"fmt"

	"golang.org/x/sync/errgroup"

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

func (n *RootNotifier) GetNotifierId() int64 {
	return 0
}

func (n *RootNotifier) GetIsDefault() bool {
	return false
}

func (n *RootNotifier) Notify(context *EvalContext) error {
	notifiers, err := n.getNotifiers(context.Rule.OrgId, context.Rule.Notifications, context)
	if err != nil {
		return err
	}

	n.log.Info("Sending notifications for", "ruleId", context.Rule.Id, "sent count", len(notifiers))

	if len(notifiers) == 0 {
		return nil
	}

	if err = n.uploadImage(context); err != nil {
		n.log.Error("Failed to upload alert panel image.", "error", err)
	}

	return n.sendNotifications(context, notifiers)
}

func (n *RootNotifier) sendNotifications(context *EvalContext, notifiers []Notifier) error {
	g, _ := errgroup.WithContext(context.Ctx)

	for _, notifier := range notifiers {
		not := notifier //avoid updating scope variable in go routine
		n.log.Info("Sending notification", "type", not.GetType(), "id", not.GetNotifierId(), "isDefault", not.GetIsDefault())
		g.Go(func() error { return not.Notify(context) })
	}

	return g.Wait()
}

func (n *RootNotifier) uploadImage(context *EvalContext) (err error) {
	uploader, err := imguploader.NewImageUploader()
	if err != nil {
		return err
	}

	renderOpts := &renderer.RenderOpts{
		Width:   "800",
		Height:  "400",
		Timeout: "30",
		OrgId:   context.Rule.OrgId,
	}

	if slug, err := context.GetDashboardSlug(); err != nil {
		return err
	} else {
		renderOpts.Path = fmt.Sprintf("dashboard-solo/db/%s?&panelId=%d", slug, context.Rule.PanelId)
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
