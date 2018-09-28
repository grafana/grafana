package alerting

import (
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/imguploader"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"

	m "github.com/grafana/grafana/pkg/models"
)

type NotifierPlugin struct {
	Type            string          `json:"type"`
	Name            string          `json:"name"`
	Description     string          `json:"description"`
	OptionsTemplate string          `json:"optionsTemplate"`
	Factory         NotifierFactory `json:"-"`
}

type NotificationService interface {
	SendIfNeeded(context *EvalContext) error
}

func NewNotificationService(renderService rendering.Service) NotificationService {
	return &notificationService{
		log:           log.New("alerting.notifier"),
		renderService: renderService,
	}
}

type notificationService struct {
	log           log.Logger
	renderService rendering.Service
}

func (n *notificationService) SendIfNeeded(context *EvalContext) error {
	notifierStates, err := n.getNeededNotifiers(context.Rule.OrgId, context.Rule.Notifications, context)
	if err != nil {
		return err
	}

	if len(notifierStates) == 0 {
		return nil
	}

	if notifierStates.ShouldUploadImage() {
		if err = n.uploadImage(context); err != nil {
			n.log.Error("Failed to upload alert panel image.", "error", err)
		}
	}

	return n.sendNotifications(context, notifierStates)
}

func (n *notificationService) sendAndMarkAsComplete(evalContext *EvalContext, notifierState *NotifierState) error {
	not := notifierState.notifier
	n.log.Debug("Sending notification", "type", not.GetType(), "id", not.GetNotifierId(), "isDefault", not.GetIsDefault())
	metrics.M_Alerting_Notification_Sent.WithLabelValues(not.GetType()).Inc()

	err := not.Notify(evalContext)

	if err != nil {
		n.log.Error("failed to send notification", "id", not.GetNotifierId())
	} else {
		notifierState.state.SentAt = time.Now().UTC().Unix()
	}

	if evalContext.IsTestRun {
		return nil
	}

	cmd := &m.SetAlertNotificationStateToCompleteCommand{
		State: notifierState.state,
	}

	if err = bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		if err == m.ErrAlertNotificationStateVersionConflict {
			n.log.Error("notification state out of sync", "id", not.GetNotifierId())
			return nil
		}

		return err
	}

	return nil
}

func (n *notificationService) sendNotification(evalContext *EvalContext, notifierState *NotifierState) error {
	if !evalContext.IsTestRun {
		setPendingCmd := &m.SetAlertNotificationStateToPendingCommand{
			State: notifierState.state,
		}

		err := bus.DispatchCtx(evalContext.Ctx, setPendingCmd)
		if err == m.ErrAlertNotificationStateVersionConflict {
			return nil
		}

		if err != nil {
			return err
		}
	}

	return n.sendAndMarkAsComplete(evalContext, notifierState)
}

func (n *notificationService) sendNotifications(evalContext *EvalContext, notifierStates NotifierStateSlice) error {
	for _, notifierState := range notifierStates {
		err := n.sendNotification(evalContext, notifierState)
		if err != nil {
			n.log.Error("failed to send notification", "id", notifierState.notifier.GetNotifierId())
		}
	}

	return nil
}

func (n *notificationService) uploadImage(context *EvalContext) (err error) {
	uploader, err := imguploader.NewImageUploader()
	if err != nil {
		return err
	}

	renderOpts := rendering.Opts{
		Width:           1000,
		Height:          500,
		Timeout:         alertTimeout / 2,
		OrgId:           context.Rule.OrgId,
		OrgRole:         m.ROLE_ADMIN,
		ConcurrentLimit: setting.AlertingRenderLimit,
	}

	ref, err := context.GetDashboardUID()
	if err != nil {
		return err
	}

	renderOpts.Path = fmt.Sprintf("d-solo/%s/%s?panelId=%d", ref.Uid, ref.Slug, context.Rule.PanelId)

	result, err := n.renderService.Render(context.Ctx, renderOpts)
	if err != nil {
		return err
	}

	context.ImageOnDiskPath = result.FilePath
	context.ImagePublicUrl, err = uploader.Upload(context.Ctx, context.ImageOnDiskPath)
	if err != nil {
		return err
	}

	if context.ImagePublicUrl != "" {
		n.log.Info("uploaded screenshot of alert to external image store", "url", context.ImagePublicUrl)
	}

	return nil
}

func (n *notificationService) getNeededNotifiers(orgId int64, notificationIds []int64, evalContext *EvalContext) (NotifierStateSlice, error) {
	query := &m.GetAlertNotificationsToSendQuery{OrgId: orgId, Ids: notificationIds}

	if err := bus.Dispatch(query); err != nil {
		return nil, err
	}

	var result NotifierStateSlice
	for _, notification := range query.Result {
		not, err := n.createNotifierFor(notification)
		if err != nil {
			n.log.Error("Could not create notifier", "notifier", notification.Id)
			continue
		}

		query := &m.GetNotificationStateQuery{
			NotifierId: notification.Id,
			AlertId:    evalContext.Rule.Id,
			OrgId:      evalContext.Rule.OrgId,
		}

		err = bus.DispatchCtx(evalContext.Ctx, query)
		if err != nil {
			n.log.Error("Could not get notification state.", "notifier", notification.Id)
			continue
		}

		if not.ShouldNotify(evalContext.Ctx, evalContext, query.Result) {
			result = append(result, &NotifierState{
				notifier: not,
				state:    query.Result,
			})
		}
	}

	return result, nil
}

func (n *notificationService) createNotifierFor(model *m.AlertNotification) (Notifier, error) {
	notifierPlugin, found := notifierFactories[model.Type]
	if !found {
		return nil, errors.New("Unsupported notification type")
	}

	return notifierPlugin.Factory(model)
}

type NotifierFactory func(notification *m.AlertNotification) (Notifier, error)

var notifierFactories = make(map[string]*NotifierPlugin)

func RegisterNotifier(plugin *NotifierPlugin) {
	notifierFactories[plugin.Type] = plugin
}

func GetNotifiers() []*NotifierPlugin {
	list := make([]*NotifierPlugin, 0)

	for _, value := range notifierFactories {
		list = append(list, value)
	}

	return list
}
