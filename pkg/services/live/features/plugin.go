package features

import (
	"context"
	"fmt"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
)

//go:generate mockgen -destination=mock.go -package=features github.com/grafana/grafana/pkg/services/live/features ChannelPublisher,PresenceGetter,PluginContextGetter,StreamRunner

type ChannelPublisher interface {
	Publish(channel string, data []byte) error
}

type PresenceGetter interface {
	GetNumSubscribers(channel string) (int, error)
}

type PluginContextGetter interface {
	GetPluginContext(user *models.SignedInUser, pluginID string, datasourceUID string) (backend.PluginContext, bool, error)
}

type StreamRunner interface {
	RunStream(ctx context.Context, request *backend.RunStreamRequest, sender backend.StreamPacketSender) error
}

type streamSender struct {
	channel          string
	channelPublisher ChannelPublisher
}

func newStreamSender(channel string, publisher ChannelPublisher) *streamSender {
	return &streamSender{channel: channel, channelPublisher: publisher}
}

func (p *streamSender) Send(packet *backend.StreamPacket) error {
	return p.channelPublisher.Publish(p.channel, packet.Payload)
}

// PluginRunner can handle streaming operations for channels belonging to plugins.
type PluginRunner struct {
	pluginID            string
	datasourceUID       string
	pluginContextGetter PluginContextGetter
	handler             backend.StreamHandler
	streamManager       *StreamManager
}

// NewPluginRunner creates new PluginRunner.
func NewPluginRunner(pluginID string, datasourceUID string, streamManager *StreamManager, pluginContextGetter PluginContextGetter, handler backend.StreamHandler) *PluginRunner {
	return &PluginRunner{
		pluginID:            pluginID,
		datasourceUID:       datasourceUID,
		pluginContextGetter: pluginContextGetter,
		handler:             handler,
		streamManager:       streamManager,
	}
}

// GetHandlerForPath gets the handler for a path.
func (m *PluginRunner) GetHandlerForPath(path string) (models.ChannelHandler, error) {
	return &PluginPathRunner{
		path:                path,
		pluginID:            m.pluginID,
		datasourceUID:       m.datasourceUID,
		streamManager:       m.streamManager,
		handler:             m.handler,
		pluginContextGetter: m.pluginContextGetter,
	}, nil
}

// PluginPathRunner can handle streaming operations for channels belonging to plugin specific path.
type PluginPathRunner struct {
	path                string
	pluginID            string
	datasourceUID       string
	streamManager       *StreamManager
	handler             backend.StreamHandler
	pluginContextGetter PluginContextGetter
}

// OnSubscribe passes control to a plugin.
func (r *PluginPathRunner) OnSubscribe(ctx context.Context, user *models.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, bool, error) {
	pCtx, found, err := r.pluginContextGetter.GetPluginContext(user, r.pluginID, r.datasourceUID)
	if err != nil {
		logger.Error("Get plugin context error", "error", err, "path", r.path)
		return models.SubscribeReply{}, false, err
	}
	if !found {
		logger.Error("Plugin context not found", "path", r.path)
		return models.SubscribeReply{}, false, centrifuge.ErrorInternal
	}
	resp, err := r.handler.CanSubscribeToStream(ctx, &backend.SubscribeToStreamRequest{
		PluginContext: pCtx,
		Path:          r.path,
	})
	if err != nil {
		logger.Error("Plugin CanSubscribeToStream call error", "error", err, "path", r.path)
		return models.SubscribeReply{}, false, err
	}
	if !resp.OK {
		return models.SubscribeReply{}, false, nil
	}
	err = r.streamManager.SubmitStream(e.Channel, r.path, pCtx, r.handler)
	if err != nil {
		logger.Error("Error submitting stream to manager", "error", err, "path", r.path)
		return models.SubscribeReply{}, false, centrifuge.ErrorInternal
	}
	return models.SubscribeReply{
		Presence: true,
	}, true, nil
}

// OnPublish passes control to a plugin.
func (r *PluginPathRunner) OnPublish(_ context.Context, _ *models.SignedInUser, _ models.PublishEvent) (models.PublishReply, bool, error) {
	// TODO: pass control to a plugin.
	return models.PublishReply{}, false, fmt.Errorf("not implemented yet")
}
