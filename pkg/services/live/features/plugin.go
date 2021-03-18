package features

import (
	"context"
	"fmt"
	"sync"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
)

type streamSender struct {
	channel          string
	channelPublisher channelPublisher
}

func newStreamSender(channel string, publisher channelPublisher) *streamSender {
	return &streamSender{channel: channel, channelPublisher: publisher}
}

func (p *streamSender) Send(packet *backend.StreamPacket) error {
	return p.channelPublisher.Publish(p.channel, packet.Payload)
}

type PluginRunner struct {
	pluginID            string
	datasourceUID       string
	pluginContextGetter pluginContextGetter
	handler             backend.StreamHandler
	streamManager       *StreamManager
}

type pluginContextGetter interface {
	GetPluginContext(ctx context.Context, pluginID string, datasourceUID string) (backend.PluginContext, bool, error)
}

type channelPublisher interface {
	Publish(channel string, data []byte) error
}

type presenceGetter interface {
	GetNumSubscribers(channel string) (int, error)
}

func NewPluginRunner(pluginID string, datasourceUID string, streamManager *StreamManager, pluginContextGetter pluginContextGetter, handler backend.StreamHandler) *PluginRunner {
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
		pluginContextGetter: m.pluginContextGetter,
		handler:             m.handler,
		streamManager:       m.streamManager,
	}, nil
}

type PluginPathRunner struct {
	mu                  sync.RWMutex
	path                string
	pluginID            string
	datasourceUID       string
	pluginContextGetter pluginContextGetter
	handler             backend.StreamHandler
	streamManager       *StreamManager
}

// OnSubscribe ...
func (r *PluginPathRunner) OnSubscribe(client *centrifuge.Client, e centrifuge.SubscribeEvent) (centrifuge.SubscribeReply, error) {
	pCtx, found, err := r.pluginContextGetter.GetPluginContext(client.Context(), r.pluginID, r.datasourceUID)
	if err != nil {
		logger.Error("Get plugin context error", "error", err, "path", r.path)
		return centrifuge.SubscribeReply{}, err
	}
	if !found {
		logger.Error("Plugin context not found", "path", r.path)
		return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
	}
	resp, err := r.handler.CanSubscribeToStream(context.Background(), &backend.SubscribeToStreamRequest{
		PluginContext: pCtx,
		Path:          r.path,
	})
	if err != nil {
		logger.Error("Plugin CanSubscribeToStream call error", "error", err, "path", r.path)
		return centrifuge.SubscribeReply{}, err
	}
	if !resp.OK {
		return centrifuge.SubscribeReply{}, centrifuge.ErrorPermissionDenied
	}
	err = r.streamManager.SubmitStream(e.Channel, r.path, pCtx, r.handler)
	if err != nil {
		logger.Error("Error submitting stream to manager", "error", err, "path", r.path)
		return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
	}
	return centrifuge.SubscribeReply{
		Options: centrifuge.SubscribeOptions{
			Presence: true,
		},
	}, nil
}

// OnPublish ...
func (r *PluginPathRunner) OnPublish(_ *centrifuge.Client, _ centrifuge.PublishEvent) (centrifuge.PublishReply, error) {
	return centrifuge.PublishReply{}, fmt.Errorf("can not publish to plugin")
}
