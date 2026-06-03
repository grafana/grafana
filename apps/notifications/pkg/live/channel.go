package live

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/live/model"
)

// ChannelHandler handles grafana/notifications/<orgID>/<recipientUID> channels.
// Subscribe is permitted for any signed-in user (auth cut for hackathon).
// Client-side publish is always denied; events are server-pushed only.
type ChannelHandler struct{}

// NewChannelHandler returns a new ChannelHandler.
func NewChannelHandler() *ChannelHandler { return &ChannelHandler{} }

// GetHandlerForPath implements model.ChannelHandlerFactory.
// All per-user paths share the same handler.
func (h *ChannelHandler) GetHandlerForPath(_ string) (model.ChannelHandler, error) {
	return h, nil
}

// OnSubscribe allows any signed-in user to subscribe (auth skipped for hackathon).
func (h *ChannelHandler) OnSubscribe(_ context.Context, _ identity.Requester, _ model.SubscribeEvent) (model.SubscribeReply, backend.SubscribeStreamStatus, error) {
	return model.SubscribeReply{}, backend.SubscribeStreamStatusOK, nil
}

// OnPublish denies all client-initiated publishes; events are server-only.
func (h *ChannelHandler) OnPublish(_ context.Context, _ identity.Requester, _ model.PublishEvent) (model.PublishReply, backend.PublishStreamStatus, error) {
	return model.PublishReply{}, backend.PublishStreamStatusPermissionDenied, nil
}
