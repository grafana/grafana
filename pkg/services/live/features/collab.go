package features

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/live/model"
)

// CollabSessionInfo is the initial state returned to a newly subscribed client.
type CollabSessionInfo struct {
	Users []CollabUserInfo  `json:"users"`
	Locks map[string]string `json:"locks"` // target → userId
	Seq   int64             `json:"seq"`
}

// CollabUserInfo represents a connected user in a collaboration session.
type CollabUserInfo struct {
	UserID      string `json:"userId"`
	DisplayName string `json:"displayName"`
	AvatarURL   string `json:"avatarUrl"`
	Color       string `json:"color"`
}

// CollabService is the interface that the collab app implements.
// pkg/services/live/ depends on this interface — not on the app module directly.
// The app module provides the concrete implementation via Wire DI.
type CollabService interface {
	// UserJoin adds a user to a collaboration session, returning the initial state.
	UserJoin(ctx context.Context, namespace, dashboardUID, userID, displayName, avatarURL string) (*CollabSessionInfo, error)
	// UserLeave removes a user from a collaboration session and releases their locks.
	UserLeave(ctx context.Context, namespace, dashboardUID, userID string) error
	// ProcessMessage handles a raw client message and returns the server response for broadcast.
	ProcessMessage(ctx context.Context, namespace, dashboardUID string, data []byte, userID string) ([]byte, error)
}

// CollabHandler manages the `grafana/collab/*` channels for real-time dashboard collaboration.
type CollabHandler struct {
	service       CollabService
	features      featuremgmt.FeatureToggles
	accessControl dashboards.DashboardAccessService
	publisher     model.ChannelPublisher
}

// NewCollabHandler creates a new CollabHandler.
func NewCollabHandler(
	service CollabService,
	features featuremgmt.FeatureToggles,
	accessControl dashboards.DashboardAccessService,
	publisher model.ChannelPublisher,
) *CollabHandler {
	return &CollabHandler{
		service:       service,
		features:      features,
		accessControl: accessControl,
		publisher:     publisher,
	}
}

// GetHandlerForPath returns a handler based on the channel path suffix.
// Paths: "{namespace}/{uid}/ops" or "{namespace}/{uid}/cursors"
func (h *CollabHandler) GetHandlerForPath(path string) (model.ChannelHandler, error) {
	parts := strings.Split(path, "/")
	if len(parts) < 3 {
		return nil, fmt.Errorf("invalid collab channel path: %s", path)
	}

	suffix := parts[len(parts)-1]
	switch suffix {
	case "ops":
		return &collabOpsHandler{handler: h, namespace: parts[0], uid: parts[1]}, nil
	case "cursors":
		return &collabCursorsHandler{handler: h, namespace: parts[0], uid: parts[1]}, nil
	default:
		return nil, fmt.Errorf("unknown collab channel type: %s", suffix)
	}
}

// collabOpsHandler handles the server-mediated ops channel.
type collabOpsHandler struct {
	handler   *CollabHandler
	namespace string
	uid       string
}

func (h *collabOpsHandler) OnSubscribe(ctx context.Context, user identity.Requester, e model.SubscribeEvent) (model.SubscribeReply, backend.SubscribeStreamStatus, error) {
	// Check feature flag.
	if !h.handler.features.IsEnabled(ctx, featuremgmt.FlagDashboardCollaboration) {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied,
			fmt.Errorf("dashboardCollaboration feature flag is not enabled")
	}

	// Check dashboard write permission.
	ok, err := h.handler.accessControl.HasDashboardAccess(ctx, user, utils.VerbUpdate, h.namespace, h.uid)
	if err != nil {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, err
	}
	if !ok {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied,
			fmt.Errorf("user does not have write access to dashboard %s/%s", h.namespace, h.uid)
	}

	// Join the session.
	info, err := h.handler.service.UserJoin(ctx, h.namespace, h.uid,
		user.GetUID(), user.GetLogin(), "" /* avatarURL not on Requester */)
	if err != nil {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, err
	}

	data, err := json.Marshal(info)
	if err != nil {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, err
	}

	return model.SubscribeReply{
		Presence:  true,
		JoinLeave: true,
		Data:      data,
	}, backend.SubscribeStreamStatusOK, nil
}

func (h *collabOpsHandler) OnPublish(ctx context.Context, user identity.Requester, e model.PublishEvent) (model.PublishReply, backend.PublishStreamStatus, error) {
	resp, err := h.handler.service.ProcessMessage(ctx, h.namespace, h.uid, e.Data, user.GetUID())
	if err != nil {
		return model.PublishReply{}, backend.PublishStreamStatusNotFound, err
	}

	return model.PublishReply{Data: resp}, backend.PublishStreamStatusOK, nil
}

// collabCursorsHandler handles the pass-through cursors channel.
type collabCursorsHandler struct {
	handler   *CollabHandler
	namespace string
	uid       string
}

func (h *collabCursorsHandler) OnSubscribe(ctx context.Context, user identity.Requester, e model.SubscribeEvent) (model.SubscribeReply, backend.SubscribeStreamStatus, error) {
	// Same auth checks as ops channel.
	if !h.handler.features.IsEnabled(ctx, featuremgmt.FlagDashboardCollaboration) {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied,
			fmt.Errorf("dashboardCollaboration feature flag is not enabled")
	}

	ok, err := h.handler.accessControl.HasDashboardAccess(ctx, user, utils.VerbUpdate, h.namespace, h.uid)
	if err != nil {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, err
	}
	if !ok {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied,
			fmt.Errorf("user does not have write access to dashboard %s/%s", h.namespace, h.uid)
	}

	return model.SubscribeReply{
		Presence: true,
	}, backend.SubscribeStreamStatusOK, nil
}

func (h *collabCursorsHandler) OnPublish(_ context.Context, _ identity.Requester, e model.PublishEvent) (model.PublishReply, backend.PublishStreamStatus, error) {
	// Pass-through: Centrifuge broadcasts directly. Server does NOT process cursor data.
	return model.PublishReply{Data: e.Data}, backend.PublishStreamStatusOK, nil
}
