package features

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/live/model"
)

type actionType string

const (
	ActionSaved    actionType = "saved"
	ActionDeleted  actionType = "deleted"
	EditingStarted actionType = "editing-started"
	//EditingFinished actionType = "editing-finished"
)

// DashboardEvent events related to dashboards
type dashboardEvent struct {
	UID       string     `json:"uid"`
	Action    actionType `json:"action"` // saved, editing, deleted
	SessionID string     `json:"sessionId,omitempty"`
}

// DashboardHandler manages all the `grafana/dashboard/*` channels
type DashboardHandler struct {
	Publisher        model.ChannelPublisher
	ClientCount      model.ChannelClientCount
	DashboardService dashboards.DashboardService
	AccessControl    accesscontrol.AccessControl
}

// GetHandlerForPath called on init
func (h *DashboardHandler) GetHandlerForPath(_ string) (model.ChannelHandler, error) {
	return h, nil // all dashboards share the same handler
}

// OnSubscribe for now allows anyone to subscribe to any dashboard
func (h *DashboardHandler) OnSubscribe(ctx context.Context, user identity.Requester, e model.SubscribeEvent) (model.SubscribeReply, backend.SubscribeStreamStatus, error) {
	parts := strings.Split(e.Path, "/")

	// make sure can view this dashboard
	if len(parts) == 2 && parts[0] == "uid" {
		query := dashboards.GetDashboardQuery{UID: parts[1], OrgID: user.GetOrgID()}
		_, err := h.DashboardService.GetDashboard(ctx, &query)
		if err != nil {
			logger.Error("Error getting dashboard", "query", query, "error", err)
			return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, nil
		}

		evaluator := accesscontrol.EvalPermission(dashboards.ActionDashboardsRead, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(parts[1]))
		canView, err := h.AccessControl.Evaluate(ctx, user, evaluator)
		if err != nil || !canView {
			return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, err
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
func (h *DashboardHandler) OnPublish(ctx context.Context, requester identity.Requester, e model.PublishEvent) (model.PublishReply, backend.PublishStreamStatus, error) {
	parts := strings.Split(e.Path, "/")

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
		query := dashboards.GetDashboardQuery{UID: parts[1], OrgID: requester.GetOrgID()}
		_, err = h.DashboardService.GetDashboard(ctx, &query)
		if err != nil {
			logger.Error("Unknown dashboard", "query", query)
			return model.PublishReply{}, backend.PublishStreamStatusNotFound, nil
		}

		evaluator := accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(parts[1]))
		canEdit, err := h.AccessControl.Evaluate(ctx, requester, evaluator)
		if err != nil {
			return model.PublishReply{}, backend.PublishStreamStatusNotFound, fmt.Errorf("internal error")
		}

		// Ignore edit events if the user can not edit
		if !canEdit {
			return model.PublishReply{}, backend.PublishStreamStatusNotFound, nil // NOOP
		}

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
	return h.Publisher(orgID, "grafana/dashboard/uid/"+event.UID, msg)
}

// DashboardSaved will broadcast to all connected dashboards
func (h *DashboardHandler) DashboardSaved(orgID int64, uid string) error {
	return h.publish(orgID, dashboardEvent{
		UID:    uid,
		Action: ActionSaved,
	})
}

// DashboardDeleted will broadcast to all connected dashboards
func (h *DashboardHandler) DashboardDeleted(orgID int64, uid string) error {
	return h.publish(orgID, dashboardEvent{
		UID:    uid,
		Action: ActionDeleted,
	})
}
