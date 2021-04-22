package features

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/models"
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
func (h *DashboardHandler) OnSubscribe(ctx context.Context, _ *models.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	return models.SubscribeReply{
		Presence:  true,
		JoinLeave: true,
	}, backend.SubscribeStreamStatusOK, nil
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
	return h.Publisher("grafana/dashboard/changes", msg)
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
