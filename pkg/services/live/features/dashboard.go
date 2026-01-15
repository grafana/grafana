package features

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
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
	UID             string     `json:"uid"`
	Action          actionType `json:"action"` // saved, editing, deleted
	SessionID       string     `json:"sessionId,omitempty"`
	ResourceVersion string     `json:"rv,omitempty"`
}

// DashboardHandler manages all the `grafana/dashboard/*` channels
type DashboardHandler struct {
	Publisher     model.ChannelPublisher
	ClientCount   model.ChannelClientCount
	AccessControl dashboards.DashboardAccessService
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
		ns := types.OrgNamespaceFormatter(user.GetOrgID())
		ok, err := h.AccessControl.HasDashboardAccess(ctx, user, utils.VerbGet, ns, parts[1])
		if ok && err == nil {
			return model.SubscribeReply{
				Presence:  true,
				JoinLeave: true,
			}, backend.SubscribeStreamStatusOK, nil
		}
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, err
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

		ns := types.OrgNamespaceFormatter(requester.GetOrgID())
		ok, err := h.AccessControl.HasDashboardAccess(ctx, requester, utils.VerbUpdate, ns, parts[1])
		if ok && err == nil {
			msg, err := json.Marshal(event)
			if err != nil {
				return model.PublishReply{}, backend.PublishStreamStatusNotFound, fmt.Errorf("internal error")
			}
			return model.PublishReply{Data: msg}, backend.PublishStreamStatusOK, nil
		}
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
func (h *DashboardHandler) DashboardSaved(orgID int64, uid string, rv string) error {
	return h.publish(orgID, dashboardEvent{
		UID:             uid,
		Action:          ActionSaved,
		ResourceVersion: rv,
	})
}

// DashboardDeleted will broadcast to all connected dashboards
func (h *DashboardHandler) DashboardDeleted(orgID int64, uid string) error {
	return h.publish(orgID, dashboardEvent{
		UID:    uid,
		Action: ActionDeleted,
	})
}
