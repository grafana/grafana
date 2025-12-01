package realtime

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/exploremap/crdt"
	"github.com/grafana/grafana/pkg/services/live/model"
)

// ExploreMapChannelHandler handles Grafana Live channels for Explore Maps
type ExploreMapChannelHandler struct {
	hub *OperationHub
}

// NewExploreMapChannelHandler creates a new channel handler
func NewExploreMapChannelHandler(hub *OperationHub) *ExploreMapChannelHandler {
	return &ExploreMapChannelHandler{
		hub: hub,
	}
}

// OnSubscribe is called when a client subscribes to the channel
func (h *ExploreMapChannelHandler) OnSubscribe(ctx context.Context, user identity.Requester, e model.SubscribeEvent) (model.SubscribeReply, backend.SubscribeStreamStatus, error) {
	// Extract map UID from channel path
	// Channel format: grafana/explore-map/{mapUid}
	mapUID := extractMapUID(e.Channel)
	if mapUID == "" {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, nil
	}

	// TODO: Check access permissions
	// For now, allow all authenticated users

	// Get current CRDT state
	state, err := h.hub.GetState(ctx, mapUID)
	if err != nil {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, nil
	}

	// Serialize state as initial data
	state.mu.RLock()
	stateData := map[string]interface{}{
		"title":  state.Title,
		"panels": state.Panels,
		"zIndex": state.ZIndex,
	}
	state.mu.RUnlock()

	data, err := json.Marshal(stateData)
	if err != nil {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, err
	}

	return model.SubscribeReply{
		Data: data,
	}, backend.SubscribeStreamStatusOK, nil
}

// OnPublish is called when a client publishes to the channel
func (h *ExploreMapChannelHandler) OnPublish(ctx context.Context, user identity.Requester, e model.PublishEvent) (model.PublishReply, backend.PublishStreamStatus, error) {
	// Parse operation
	var op crdt.Operation
	if err := json.Unmarshal(e.Data, &op); err != nil {
		logger.Warn("Failed to parse operation", "error", err)
		return model.PublishReply{}, backend.PublishStreamStatusPermissionDenied, fmt.Errorf("failed to parse operation: %w", err)
	}

	// TODO: Validate user has permission to modify the map

	// Process operation through hub
	if err := h.hub.HandleOperation(ctx, op); err != nil {
		logger.Warn("Failed to handle operation", "error", err)
		return model.PublishReply{}, backend.PublishStreamStatusPermissionDenied, err
	}

	return model.PublishReply{}, backend.PublishStreamStatusOK, nil
}

// GetHandlerForPath returns the channel handler for a given path
func (h *ExploreMapChannelHandler) GetHandlerForPath(path string) (model.ChannelHandler, error) {
	return h, nil
}

// extractMapUID extracts the map UID from a channel path
// Channel format: grafana/explore-map/{mapUid}
func extractMapUID(channel string) string {
	parts := strings.Split(channel, "/")
	if len(parts) >= 3 && parts[1] == "explore-map" {
		return parts[2]
	}
	return ""
}
