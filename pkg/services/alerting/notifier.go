package alerting

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/imguploader"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
)

// for stubbing in tests
var newImageUploaderProvider = func() (imguploader.ImageUploader, error) {
	return imguploader.NewImageUploader()
}

// NotifierPlugin holds meta information about a notifier.
type NotifierPlugin struct {
	Type            string          `json:"type"`
	Name            string          `json:"name"`
	Description     string          `json:"description"`
	OptionsTemplate string          `json:"optionsTemplate"`
	Factory         NotifierFactory `json:"-"`
}

func newNotificationService(renderService rendering.Service) *notificationService {
	return &notificationService{
		log:           log.New("alerting.notifier"),
		renderService: renderService,
	}
}

type notificationService struct {
	log           log.Logger
	renderService rendering.Service
}

func (n *notificationService) SendIfNeeded(evalCtx *EvalContext) error {
	notifierStates, err := n.getNeededNotifiers(evalCtx.Rule.OrgID, evalCtx.Rule.Notifications, evalCtx)
	if err != nil {
		n.log.Error("Failed to get alert notifiers", "error", err)
		return err
	}

	if len(notifierStates) == 0 {
		return nil
	}

	if notifierStates.ShouldUploadImage() {
		// Create a copy of EvalContext and give it a new, shorter, timeout context to upload the image
		uploadEvalCtx := *evalCtx
		timeout := setting.AlertingNotificationTimeout / 2
		var uploadCtxCancel func()
		uploadEvalCtx.Ctx, uploadCtxCancel = context.WithTimeout(evalCtx.Ctx, timeout)

		// Try to upload the image without consuming all the time allocated for EvalContext
		if err = n.renderAndUploadImage(&uploadEvalCtx, timeout); err != nil {
			n.log.Error("Failed to render and upload alert panel image.", "ruleId", uploadEvalCtx.Rule.ID, "error", err)
		}
		uploadCtxCancel()
		evalCtx.ImageOnDiskPath = uploadEvalCtx.ImageOnDiskPath
		evalCtx.ImagePublicURL = uploadEvalCtx.ImagePublicURL
	}

	return n.sendNotifications(evalCtx, notifierStates)
}

func (n *notificationService) sendAndMarkAsComplete(evalContext *EvalContext, notifierState *notifierState) error {
	notifier := notifierState.notifier

	n.log.Debug("Sending notification", "type", notifier.GetType(), "uid", notifier.GetNotifierUID(), "isDefault", notifier.GetIsDefault())
	metrics.MAlertingNotificationSent.WithLabelValues(notifier.GetType()).Inc()

	err := notifier.Notify(evalContext)

	if err != nil {
		n.log.Error("failed to send notification", "uid", notifier.GetNotifierUID(), "error", err)
		metrics.MAlertingNotificationFailed.WithLabelValues(notifier.GetType()).Inc()
		return err
	}

	if evalContext.IsTestRun {
		return nil
	}

	cmd := &models.SetAlertNotificationStateToCompleteCommand{
		Id:      notifierState.state.Id,
		Version: notifierState.state.Version,
	}

	return bus.DispatchCtx(evalContext.Ctx, cmd)
}

func (n *notificationService) sendNotification(evalContext *EvalContext, notifierState *notifierState) error {
	if !evalContext.IsTestRun {
		setPendingCmd := &models.SetAlertNotificationStateToPendingCommand{
			Id:                           notifierState.state.Id,
			Version:                      notifierState.state.Version,
			AlertRuleStateUpdatedVersion: evalContext.Rule.StateChanges,
		}

		err := bus.DispatchCtx(evalContext.Ctx, setPendingCmd)
		if err == models.ErrAlertNotificationStateVersionConflict {
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
			n.log.Error("failed to send notification", "uid", notifierState.notifier.GetNotifierUID(), "error", err)
			if evalContext.IsTestRun {
				return err
			}
		}
	}
	return nil
}

func (n *notificationService) renderAndUploadImage(evalCtx *EvalContext, timeout time.Duration) (err error) {
	uploader, err := newImageUploaderProvider()
	if err != nil {
		return err
	}

	renderOpts := rendering.Opts{
		Width:           1000,
		Height:          500,
		Timeout:         timeout,
		OrgId:           evalCtx.Rule.OrgID,
		OrgRole:         models.ROLE_ADMIN,
		ConcurrentLimit: setting.AlertingRenderLimit,
	}

	ref, err := evalCtx.GetDashboardUID()
	if err != nil {
		return err
	}

	renderOpts.Path = fmt.Sprintf("d-solo/%s/%s?orgId=%d&panelId=%d", ref.Uid, ref.Slug, evalCtx.Rule.OrgID, evalCtx.Rule.PanelID)

	n.log.Debug("Rendering alert panel image", "ruleId", evalCtx.Rule.ID, "urlPath", renderOpts.Path)
	start := time.Now()
	result, err := n.renderService.Render(evalCtx.Ctx, renderOpts)
	if err != nil {
		return err
	}
	took := time.Since(start)

	n.log.Debug("Rendered alert panel image", "ruleId", evalCtx.Rule.ID, "path", result.FilePath, "took", took)

	evalCtx.ImageOnDiskPath = result.FilePath

	n.log.Debug("Uploading alert panel image to external image store", "ruleId", evalCtx.Rule.ID, "path", evalCtx.ImageOnDiskPath)

	start = time.Now()
	evalCtx.ImagePublicURL, err = uploader.Upload(evalCtx.Ctx, evalCtx.ImageOnDiskPath)
	if err != nil {
		return err
	}
	took = time.Since(start)

	if evalCtx.ImagePublicURL != "" {
		n.log.Debug("Uploaded alert panel image to external image store", "ruleId", evalCtx.Rule.ID, "url", evalCtx.ImagePublicURL, "took", took)
	}

	return nil
}

func (n *notificationService) getNeededNotifiers(orgID int64, notificationUids []string, evalContext *EvalContext) (notifierStateSlice, error) {
	query := &models.GetAlertNotificationsWithUidToSendQuery{OrgId: orgID, Uids: notificationUids}

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

		query := &models.GetOrCreateNotificationStateQuery{
			NotifierId: notification.Id,
			AlertId:    evalContext.Rule.ID,
			OrgId:      evalContext.Rule.OrgID,
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

// InitNotifier instantiate a new notifier based on the model.
func InitNotifier(model *models.AlertNotification) (Notifier, error) {
	notifierPlugin, found := notifierFactories[model.Type]
	if !found {
		return nil, errors.New("Unsupported notification type")
	}

	return notifierPlugin.Factory(model)
}

// NotifierFactory is a signature for creating notifiers.
type NotifierFactory func(notification *models.AlertNotification) (Notifier, error)

var notifierFactories = make(map[string]*NotifierPlugin)

// RegisterNotifier register an notifier
func RegisterNotifier(plugin *NotifierPlugin) {
	notifierFactories[plugin.Type] = plugin
}

// GetNotifiers returns a list of metadata about available notifiers.
func GetNotifiers() []*NotifierPlugin {
	list := make([]*NotifierPlugin, 0)

	for _, value := range notifierFactories {
		list = append(list, value)
	}

	return list
}
