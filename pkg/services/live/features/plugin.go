package features

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
)

type streamPublisher struct {
	channel          string
	channelPublisher channelPublisher
}

func (p *streamPublisher) Send(packet *backend.StreamPacket) error {
	return p.channelPublisher.Publish(p.channel, packet.Payload)
}

type PluginRunner struct {
	pluginID            string
	channelPublisher    channelPublisher
	presenceGetter      presenceGetter
	pluginContextGetter pluginContextGetter
	handler             backend.StreamHandler
}

type pluginContextGetter interface {
	GetPluginContext(ctx context.Context, pluginID string, datasourceID int64) (backend.PluginContext, bool, error)
}

type channelPublisher interface {
	Publish(channel string, data []byte) error
}

type presenceGetter interface {
	GetNumSubscribers(channel string) (int, error)
}

func NewPluginRunner(pluginID string, publisher channelPublisher, presenceGetter presenceGetter, pluginContextGetter pluginContextGetter, handler backend.StreamHandler) *PluginRunner {
	return &PluginRunner{
		pluginID:            pluginID,
		channelPublisher:    publisher,
		presenceGetter:      presenceGetter,
		pluginContextGetter: pluginContextGetter,
		handler:             handler,
	}
}

// GetHandlerForPath gets the handler for a path.
func (m *PluginRunner) GetHandlerForPath(path string) (models.ChannelHandler, error) {
	return &PluginPathRunner{
		path:                path,
		pluginID:            m.pluginID,
		channelPublisher:    m.channelPublisher,
		presenceGetter:      m.presenceGetter,
		pluginContextGetter: m.pluginContextGetter,
		handler:             m.handler,
	}, nil
}

type PluginPathRunner struct {
	mu                  sync.RWMutex
	path                string
	pluginID            string
	channelPublisher    channelPublisher
	presenceGetter      presenceGetter
	pluginContextGetter pluginContextGetter
	handler             backend.StreamHandler
	streamRunning       bool
}

func (r *PluginPathRunner) watchStream(ctx context.Context, channel string, cancelFn func()) {
	numNoSubscribersChecks := 0
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(5 * time.Second):
			numSubscribers, err := r.presenceGetter.GetNumSubscribers(channel)
			if err != nil {
				continue
			}
			if numSubscribers == 0 {
				numNoSubscribersChecks++
				if numNoSubscribersChecks >= 3 {
					logger.Info("Stop stream since no active subscribers", "channel", channel, "path", r.path)
					cancelFn()
					return
				}
			} else {
				// reset counter since channel has active subscribers.
				numNoSubscribersChecks = 0
			}
		}
	}
}

func (r *PluginPathRunner) isStreamRunning() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.streamRunning
}

func (r *PluginPathRunner) setStreamRunning(running bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.streamRunning = running
}

func (r *PluginPathRunner) runStream(pCtx backend.PluginContext, channel string) {
	if r.isStreamRunning() {
		return
	}
	r.setStreamRunning(true)
	defer func() {
		r.setStreamRunning(false)
	}()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go r.watchStream(ctx, channel, cancel)
	logger.Info("Start running stream", "channel", channel, "path", r.path)
	err := r.handler.RunStream(
		ctx,
		&backend.RunStreamRequest{
			PluginContext: pCtx,
			Path:          r.path,
		},
		&streamPublisher{channel: channel, channelPublisher: r.channelPublisher},
	)
	if err != nil {
		if ctx.Err() == context.Canceled {
			logger.Info("Stream cleanly finished", "path", r.path)
		} else {
			logger.Error("Error running stream", "path", r.path, "error", err)
		}
	}
}

// OnSubscribe ....
func (r *PluginPathRunner) OnSubscribe(client *centrifuge.Client, e centrifuge.SubscribeEvent) (centrifuge.SubscribeReply, error) {
	// TODO: tmp hardcoded datasource ID!
	pCtx, found, err := r.pluginContextGetter.GetPluginContext(client.Context(), r.pluginID, 2)
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
	if r.isStreamRunning() {
		logger.Debug("Skip running new stream (already exists)", "path", r.path)
		return centrifuge.SubscribeReply{
			Options: centrifuge.SubscribeOptions{
				Presence: true,
			},
		}, nil
	}
	// TODO: better stream manager via separate entity.
	go r.runStream(pCtx, e.Channel)
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
