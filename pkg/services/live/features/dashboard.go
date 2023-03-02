package features

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/live/model"
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
	UID       string                `json:"uid"`
	Action    actionType            `json:"action"` // saved, editing, deleted
	User      *user.UserDisplayDTO  `json:"user,omitempty"`
	SessionID string                `json:"sessionId,omitempty"`
	Message   string                `json:"message,omitempty"`
	Dashboard *dashboards.Dashboard `json:"dashboard,omitempty"`
	Error     string                `json:"error,omitempty"`
}

// DashboardHandler manages all the `grafana/dashboard/*` channels
type DashboardHandler struct {
	Publisher        model.ChannelPublisher
	ClientCount      model.ChannelClientCount
	Store            db.DB
	DashboardService dashboards.DashboardService
}

// GetHandlerForPath called on init
func (h *DashboardHandler) GetHandlerForPath(_ string) (model.ChannelHandler, error) {
	return h, nil // all dashboards share the same handler
}

// OnSubscribe for now allows anyone to subscribe to any dashboard
func (h *DashboardHandler) OnSubscribe(ctx context.Context, user *user.SignedInUser, e model.SubscribeEvent) (model.SubscribeReply, backend.SubscribeStreamStatus, error) {
	parts := strings.Split(e.Path, "/")
	if parts[0] == "gitops" {
		// gitops gets all changes for everything, so lets make sure it is an admin user
		if !user.HasRole(org.RoleAdmin) {
			return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
		}
		return model.SubscribeReply{
			Presence: true,
		}, backend.SubscribeStreamStatusOK, nil
	}

	// make sure can view this dashboard
	if len(parts) == 2 && parts[0] == "uid" {
		query := dashboards.GetDashboardQuery{UID: parts[1], OrgID: user.OrgID}
		queryResult, err := h.DashboardService.GetDashboard(ctx, &query)
		if err != nil {
			logger.Error("Error getting dashboard", "query", query, "error", err)
			return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, nil
		}

		dash := queryResult
		guard, err := guardian.NewByDashboard(ctx, dash, user.OrgID, user)
		if err != nil {
			return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, err
		}
		if canView, err := guard.CanView(); err != nil || !canView {
			return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
		}

		return model.SubscribeReply{
			Presence:  true,
			JoinLeave: true,
		}, backend.SubscribeStreamStatusOK, nil
	}

	// Unknown path
	logger.Error("Unknown dashboard channel", "path", e.Path)
	return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, nil
}

// OnPublish is called when someone begins to edit a dashboard
func (h *DashboardHandler) OnPublish(ctx context.Context, user *user.SignedInUser, e model.PublishEvent) (model.PublishReply, backend.PublishStreamStatus, error) {
	parts := strings.Split(e.Path, "/")
	if parts[0] == "gitops" {
		// gitops gets all changes for everything, so lets make sure it is an admin user
		if !user.HasRole(org.RoleAdmin) {
			return model.PublishReply{}, backend.PublishStreamStatusPermissionDenied, nil
		}

		// Eventually this could broadcast a message back to the dashboard saying a pull request exists
		return model.PublishReply{}, backend.PublishStreamStatusNotFound, fmt.Errorf("not implemented yet")
	}

	// make sure can view this dashboard
	if len(parts) == 2 && parts[0] == "uid" {
		event := dashboardEvent{}
		err := json.Unmarshal(e.Data, &event)
		if err != nil || event.UID != parts[1] {
			return model.PublishReply{}, backend.PublishStreamStatusNotFound, fmt.Errorf("bad request")
		}
		if event.Action != EditingStarted {
			// just ignore the event
			return model.PublishReply{}, backend.PublishStreamStatusNotFound, fmt.Errorf("ignore???")
		}
		query := dashboards.GetDashboardQuery{UID: parts[1], OrgID: user.OrgID}
		queryResult, err := h.DashboardService.GetDashboard(ctx, &query)
		if err != nil {
			logger.Error("Unknown dashboard", "query", query)
			return model.PublishReply{}, backend.PublishStreamStatusNotFound, nil
		}

		guard, err := guardian.NewByDashboard(ctx, queryResult, user.OrgID, user)
		if err != nil {
			logger.Error("Failed to create guardian", "err", err)
			return model.PublishReply{}, backend.PublishStreamStatusNotFound, fmt.Errorf("internal error")
		}

		canEdit, err := guard.CanEdit()
		if err != nil {
			return model.PublishReply{}, backend.PublishStreamStatusNotFound, fmt.Errorf("internal error")
		}

		// Ignore edit events if the user can not edit
		if !canEdit {
			return model.PublishReply{}, backend.PublishStreamStatusNotFound, nil // NOOP
		}

		// Tell everyone who is editing
		event.User = user.ToUserDisplayDTO()

		msg, err := json.Marshal(event)
		if err != nil {
			return model.PublishReply{}, backend.PublishStreamStatusNotFound, fmt.Errorf("internal error")
		}
		return model.PublishReply{Data: msg}, backend.PublishStreamStatusOK, nil
	}

	return model.PublishReply{}, backend.PublishStreamStatusNotFound, nil
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
func (h *DashboardHandler) DashboardSaved(orgID int64, user *user.UserDisplayDTO, message string, dashboard *dashboards.Dashboard, err error) error {
	if err != nil && !h.HasGitOpsObserver(orgID) {
		return nil // only broadcast if it was OK
	}

	msg := dashboardEvent{
		UID:       dashboard.UID,
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
