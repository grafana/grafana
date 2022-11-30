package features

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

type actionType string

const (
	ActionSaved    actionType = "saved"
	ActionDeleted  actionType = "deleted"
	EditingStarted actionType = "editing-started"
	//EditingFinished actionType = "editing-finished"

	GitopsChannel = "grafana/dashboard/gitops"
)

// DashboardEvent events related to dashboards
type dashboardEvent struct {
	UID       string               `json:"uid"`
	Action    actionType           `json:"action"` // saved, editing, deleted
	User      *user.UserDisplayDTO `json:"user,omitempty"`
	SessionID string               `json:"sessionId,omitempty"`
	Message   string               `json:"message,omitempty"`
	Dashboard *models.Dashboard    `json:"dashboard,omitempty"`
	Error     string               `json:"error,omitempty"`
}

// DashboardHandler manages all the `grafana/dashboard/*` channels
type DashboardHandler struct {
	Publisher        models.ChannelPublisher
	ClientCount      models.ChannelClientCount
	Store            db.DB
	DashboardService dashboards.DashboardService
}

// GetHandlerForPath called on init
func (h *DashboardHandler) GetHandlerForPath(_ string) (models.ChannelHandler, error) {
	return h, nil // all dashboards share the same handler
}

// OnSubscribe for now allows anyone to subscribe to any dashboard
func (h *DashboardHandler) OnSubscribe(ctx context.Context, user *user.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	parts := strings.Split(e.Path, "/")
	if parts[0] == "gitops" {
		// gitops gets all changes for everything, so lets make sure it is an admin user
		if !user.HasRole(org.RoleAdmin) {
			return models.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
		}
		return models.SubscribeReply{
			Presence: true,
		}, backend.SubscribeStreamStatusOK, nil
	}

	// make sure can view this dashboard
	if len(parts) == 2 && parts[0] == "uid" {
		query := models.GetDashboardQuery{Uid: parts[1], OrgId: user.OrgID}
		if err := h.DashboardService.GetDashboard(ctx, &query); err != nil {
			logger.Error("Error getting dashboard", "query", query, "error", err)
			return models.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, nil
		}

		dash := query.Result
		guard, err := guardian.New(ctx, dash.Uid, user.OrgID, user)
		if err != nil {
			return models.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, err
		}
		if canView, err := guard.CanView(); err != nil || !canView {
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
func (h *DashboardHandler) OnPublish(ctx context.Context, user *user.SignedInUser, e models.PublishEvent) (models.PublishReply, backend.PublishStreamStatus, error) {
	parts := strings.Split(e.Path, "/")
	if parts[0] == "gitops" {
		// gitops gets all changes for everything, so lets make sure it is an admin user
		if !user.HasRole(org.RoleAdmin) {
			return models.PublishReply{}, backend.PublishStreamStatusPermissionDenied, nil
		}

		// Eventually this could broadcast a message back to the dashboard saying a pull request exists
		return models.PublishReply{}, backend.PublishStreamStatusNotFound, fmt.Errorf("not implemented yet")
	}

	// make sure can view this dashboard
	if len(parts) == 2 && parts[0] == "uid" {
		event := dashboardEvent{}
		err := json.Unmarshal(e.Data, &event)
		if err != nil || event.UID != parts[1] {
			return models.PublishReply{}, backend.PublishStreamStatusNotFound, fmt.Errorf("bad request")
		}
		if event.Action != EditingStarted {
			// just ignore the event
			return models.PublishReply{}, backend.PublishStreamStatusNotFound, fmt.Errorf("ignore???")
		}
		query := models.GetDashboardQuery{Uid: parts[1], OrgId: user.OrgID}
		if err := h.DashboardService.GetDashboard(ctx, &query); err != nil {
			logger.Error("Unknown dashboard", "query", query)
			return models.PublishReply{}, backend.PublishStreamStatusNotFound, nil
		}

		guard, err := guardian.New(ctx, query.Result.Uid, user.OrgID, user)
		if err != nil {
			logger.Error("Failed to create guardian", "err", err)
			return models.PublishReply{}, backend.PublishStreamStatusNotFound, fmt.Errorf("internal error")
		}

		canEdit, err := guard.CanEdit()
		if err != nil {
			return models.PublishReply{}, backend.PublishStreamStatusNotFound, fmt.Errorf("internal error")
		}

		// Ignore edit events if the user can not edit
		if !canEdit {
			return models.PublishReply{}, backend.PublishStreamStatusNotFound, nil // NOOP
		}

		// Tell everyone who is editing
		event.User = user.ToUserDisplayDTO()

		msg, err := json.Marshal(event)
		if err != nil {
			return models.PublishReply{}, backend.PublishStreamStatusNotFound, fmt.Errorf("internal error")
		}
		return models.PublishReply{Data: msg}, backend.PublishStreamStatusOK, nil
	}

	return models.PublishReply{}, backend.PublishStreamStatusNotFound, nil
}

// DashboardSaved should broadcast to the appropriate stream
func (h *DashboardHandler) publish(orgID int64, event dashboardEvent) error {
	msg, err := json.Marshal(event)
	if err != nil {
		return err
	}

	// Only broadcast non-error events
	if event.Error == "" {
		err = h.Publisher(orgID, "grafana/dashboard/uid/"+event.UID, msg)
		if err != nil {
			return err
		}
	}

	// Send everything to the gitops channel
	return h.Publisher(orgID, GitopsChannel, msg)
}

// DashboardSaved will broadcast to all connected dashboards
func (h *DashboardHandler) DashboardSaved(orgID int64, user *user.UserDisplayDTO, message string, dashboard *models.Dashboard, err error) error {
	if err != nil && !h.HasGitOpsObserver(orgID) {
		return nil // only broadcast if it was OK
	}

	msg := dashboardEvent{
		UID:       dashboard.Uid,
		Action:    ActionSaved,
		User:      user,
		Message:   message,
		Dashboard: dashboard,
	}

	if err != nil {
		msg.Error = err.Error()
	}

	return h.publish(orgID, msg)
}

// DashboardDeleted will broadcast to all connected dashboards
func (h *DashboardHandler) DashboardDeleted(orgID int64, user *user.UserDisplayDTO, uid string) error {
	return h.publish(orgID, dashboardEvent{
		UID:    uid,
		Action: ActionDeleted,
		User:   user,
	})
}

// HasGitOpsObserver will return true if anyone is listening to the `gitops` channel
func (h *DashboardHandler) HasGitOpsObserver(orgID int64) bool {
	count, err := h.ClientCount(orgID, GitopsChannel)
	if err != nil {
		logger.Error("error getting client count", "error", err)
		return false
	}
	return count > 0
}
