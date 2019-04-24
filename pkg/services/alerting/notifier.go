package alerting

import (
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/imguploader"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/log"
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

func (n *notificationService) sendAndMarkAsComplete(evalContext *EvalContext, notifierState *notifierState) error {
	notifier := notifierState.notifier

	n.log.Debug("Sending notification", "type", notifier.GetType(), "uid", notifier.GetNotifierUid(), "isDefault", notifier.GetIsDefault())
	metrics.M_Alerting_Notification_Sent.WithLabelValues(notifier.GetType()).Inc()

	err := notifier.Notify(evalContext)

	if err != nil {
		n.log.Error("failed to send notification", "uid", notifier.GetNotifierUid(), "error", err)
	}

	if evalContext.IsTestRun {
		return nil
	}

	cmd := &m.SetAlertNotificationStateToCompleteCommand{
		Id:      notifierState.state.Id,
		Version: notifierState.state.Version,
	}

	return bus.DispatchCtx(evalContext.Ctx, cmd)
}

func (n *notificationService) sendNotification(evalContext *EvalContext, notifierState *notifierState) error {
	if !evalContext.IsTestRun {
		setPendingCmd := &m.SetAlertNotificationStateToPendingCommand{
			Id:                           notifierState.state.Id,
			Version:                      notifierState.state.Version,
			AlertRuleStateUpdatedVersion: evalContext.Rule.StateChanges,
		}

		err := bus.DispatchCtx(evalContext.Ctx, setPendingCmd)
		if err == m.ErrAlertNotificationStateVersionConflict {
			return nil
		}

		if err != nil {
			return err
		}

		// We need to update state version to be able to log
		// unexpected version conflicts when marking notifications as ok
		notifierState.state.Version = setPendingCmd.ResultVersion
	}

	return n.sendAndMarkAsComplete(evalContext, notifierState)
}

func (n *notificationService) sendNotifications(evalContext *EvalContext, notifierStates notifierStateSlice) error {
	for _, notifierState := range notifierStates {
		err := n.sendNotification(evalContext, notifierState)
		if err != nil {
			n.log.Error("failed to send notification", "uid", notifierState.notifier.GetNotifierUid(), "error", err)
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
		Timeout:         time.Duration(setting.AlertingEvaluationTimeout.Seconds() * 0.9),
		OrgId:           context.Rule.OrgId,
		OrgRole:         m.ROLE_ADMIN,
		ConcurrentLimit: setting.AlertingRenderLimit,
	}

	ref, err := context.GetDashboardUID()
	if err != nil {
		return err
	}

	renderOpts.Path = fmt.Sprintf("d-solo/%s/%s?orgId=%d&panelId=%d", ref.Uid, ref.Slug, context.Rule.OrgId, context.Rule.PanelId)

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

func (n *notificationService) getNeededNotifiers(orgId int64, notificationUids []string, evalContext *EvalContext) (notifierStateSlice, error) {
	query := &m.GetAlertNotificationsWithUidToSendQuery{OrgId: orgId, Uids: notificationUids}

	if err := bus.Dispatch(query); err != nil {
		return nil, err
	}

	var result notifierStateSlice
	for _, notification := range query.Result {
		not, err := InitNotifier(notification)
		if err != nil {
			n.log.Error("Could not create notifier", "notifier", notification.Uid, "error", err)
			continue
		}

		query := &m.GetOrCreateNotificationStateQuery{
			NotifierId: notification.Id,
			AlertId:    evalContext.Rule.Id,
			OrgId:      evalContext.Rule.OrgId,
		}

		err = bus.DispatchCtx(evalContext.Ctx, query)
		if err != nil {
			n.log.Error("Could not get notification state.", "notifier", notification.Id, "error", err)
			continue
		}

		if not.ShouldNotify(evalContext.Ctx, evalContext, query.Result) {
			result = append(result, &notifierState{
				notifier: not,
				state:    query.Result,
			})
		}
	}

	return result, nil
}

// InitNotifier instantiate a new notifier based on the model
func InitNotifier(model *m.AlertNotification) (Notifier, error) {
	notifierPlugin, found := notifierFactories[model.Type]
	if !found {
		return nil, errors.New("Unsupported notification type")
	}

	return notifierPlugin.Factory(model)
}

type NotifierFactory func(notification *m.AlertNotification) (Notifier, error)

var notifierFactories = make(map[string]*NotifierPlugin)

// RegisterNotifier register an notifier
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
