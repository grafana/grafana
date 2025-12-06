package realtime

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

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

// messageType represents the type of message being sent
type messageType string

const (
	MessageTypeCursorUpdate   messageType = "cursor_update"
	MessageTypeCursorLeave    messageType = "cursor_leave"
	MessageTypeViewportUpdate messageType = "viewport_update"
)

// OnPublish is called when a client publishes to the channel
func (h *ExploreMapChannelHandler) OnPublish(ctx context.Context, user identity.Requester, e model.PublishEvent) (model.PublishReply, backend.PublishStreamStatus, error) {
	// First, peek at the message to see if it has a "type" field that matches cursor message types
	var msgPeek struct {
		Type messageType `json:"type"`
	}
	if err := json.Unmarshal(e.Data, &msgPeek); err == nil {
		// Check if this is a cursor/viewport message
		if msgPeek.Type == MessageTypeCursorUpdate || msgPeek.Type == MessageTypeCursorLeave || msgPeek.Type == MessageTypeViewportUpdate {
			// This is a cursor message, enrich it with user info and broadcast
			var msg struct {
				Type      messageType     `json:"type"`
				SessionID string          `json:"sessionId"`
				UserID    string          `json:"userId"`
				UserName  string          `json:"userName"`
				Timestamp int64           `json:"timestamp"`
				Data      json.RawMessage `json:"data"`
			}
			if err := json.Unmarshal(e.Data, &msg); err != nil {
				logger.Warn("Failed to parse cursor message", "error", err)
				return model.PublishReply{}, backend.PublishStreamStatusPermissionDenied, fmt.Errorf("invalid cursor message format")
			}

			// Enrich with user info
			msg.UserID = user.GetRawIdentifier()
			msg.UserName = user.GetName()
			if msg.UserName == "" {
				msg.UserName = user.GetLogin()
			}
			msg.Timestamp = time.Now().UnixMilli()

			// Marshal enriched message
			enrichedData, err := json.Marshal(msg)
			if err != nil {
				logger.Warn("Failed to marshal enriched cursor message", "error", err)
				return model.PublishReply{}, backend.PublishStreamStatusPermissionDenied, fmt.Errorf("internal error")
			}

			// Broadcast to all subscribers
			return model.PublishReply{
				Data: enrichedData,
			}, backend.PublishStreamStatusOK, nil
		}
	}

	// Not a cursor message, treat as CRDT operation
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
