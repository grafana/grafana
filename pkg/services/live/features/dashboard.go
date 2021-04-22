package features

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
)

// DashboardEvent events related to dashboards
type dashboardEvent struct {
	UID       string                    `json:"uid"`
	Action    string                    `json:"action"` // saved, editing, deleted
	User      *models.SimpleUserInfoDTO `json:"user,omitempty"`
	SessionID string                    `json:"sessionId,omitempty"`
	Message   string                    `json:"message,omitempty"`
	Dashboard *models.Dashboard         `json:"dashboard,omitempty"`
	Error     string                    `json:"error,omitempty"`
}

// DashboardHandler manages all the `grafana/dashboard/*` channels
type DashboardHandler struct {
	Publisher models.ChannelPublisher
}

// GetHandlerForPath called on init
func (h *DashboardHandler) GetHandlerForPath(path string) (models.ChannelHandler, error) {
	return h, nil // all dashboards share the same handler
}

// OnSubscribe for now allows anyone to subscribe to any dashboard
func (h *DashboardHandler) OnSubscribe(ctx context.Context, user *models.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	parts := strings.Split(e.Path, "/")
	if parts[0] == "gitops" {
		// gitops gets all changes for everything, so lets make sure it is an admin user
		if !user.HasRole(models.ROLE_ADMIN) {
			return models.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
		}
		return models.SubscribeReply{
			Presence:  true,
			JoinLeave: true, // ?? likely not necessary
		}, backend.SubscribeStreamStatusOK, nil

	}

	// make sure can view this dashboard
	if len(parts) == 2 && parts[0] == "uid" {
		query := models.GetDashboardQuery{Uid: parts[1], OrgId: user.OrgId}
		if err := bus.Dispatch(&query); err != nil {
			logger.Error("Unknown dashboard", "query", query)
			return models.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, nil
		}

		dash := query.Result
		guardian := guardian.New(dash.Id, user.OrgId, user)
		if canView, err := guardian.CanView(); err != nil || !canView {
			return models.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
		}

		return models.SubscribeReply{
			Presence:  true,
			JoinLeave: true,
		}, backend.SubscribeStreamStatusOK, nil
	}

	// Unknown path
	logger.Error("Unknown dashboard channel", "path", e.Path)
	return models.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, nil
}

// OnPublish is called when someone begins to edit a dashboard
func (h *DashboardHandler) OnPublish(ctx context.Context, _ *models.SignedInUser, e models.PublishEvent) (models.PublishReply, backend.PublishStreamStatus, error) {
	return models.PublishReply{}, backend.PublishStreamStatusOK, nil
}

// DashboardSaved should broadcast to the appropriate stream
func (h *DashboardHandler) publish(event dashboardEvent) error {
	msg, err := json.Marshal(event)
	if err != nil {
		return err
	}
	err = h.Publisher("grafana/dashboard/uid/"+event.UID, msg)
	if err != nil {
		return err
	}
	return h.Publisher("grafana/dashboard/gitops", msg)
}

// DashboardSaved will broadcast to all connected dashboards
func (h *DashboardHandler) DashboardSaved(user *models.SimpleUserInfoDTO, message string, dashboard *models.Dashboard, err error) error {
	if err != nil && !h.HasGitOpsObserver() {
		return nil // only broadcast if it was OK
	}

	msg := dashboardEvent{
		UID:       dashboard.Uid,
		Action:    "saved",
		User:      user,
		Message:   message,
		Dashboard: dashboard,
	}

	return h.publish(msg)
}

// DashboardDeleted will broadcast to all connected dashboards
func (h *DashboardHandler) DashboardDeleted(user *models.SimpleUserInfoDTO, uid string) error {
	return h.publish(dashboardEvent{
		UID:    uid,
		Action: "deleted",
		User:   user,
	})
}

// HasGitOpsObserver indicats if anyone is listening to the `gitops` channel
func (h *DashboardHandler) HasGitOpsObserver() bool {
	return false // TODO: check presense
}
