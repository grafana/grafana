package features

import (
	"context"
	"errors"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/live/model"
	"github.com/grafana/grafana/pkg/services/live/orgchannel"
	"github.com/grafana/grafana/pkg/services/live/runstream"
)

//go:generate mockgen -destination=plugin_mock.go -package=features github.com/grafana/grafana/pkg/services/live/features PluginContextGetter

type PluginContextGetter interface {
	GetPluginContext(ctx context.Context, user identity.Requester, pluginID string, datasourceUID string, skipCache bool) (backend.PluginContext, error)
}

// PluginRunner can handle streaming operations for channels belonging to plugins.
type PluginRunner struct {
	pluginID            string
	datasourceUID       string
	pluginContextGetter PluginContextGetter
	handler             backend.StreamHandler
	runStreamManager    *runstream.Manager
}

// NewPluginRunner creates new PluginRunner.
func NewPluginRunner(pluginID string, datasourceUID string, runStreamManager *runstream.Manager, pluginContextGetter PluginContextGetter, handler backend.StreamHandler) *PluginRunner {
	return &PluginRunner{
		pluginID:            pluginID,
		datasourceUID:       datasourceUID,
		pluginContextGetter: pluginContextGetter,
		handler:             handler,
		runStreamManager:    runStreamManager,
	}
}

// GetHandlerForPath gets the handler for a path.
func (m *PluginRunner) GetHandlerForPath(path string) (model.ChannelHandler, error) {
	return &PluginPathRunner{
		path:                path,
		pluginID:            m.pluginID,
		datasourceUID:       m.datasourceUID,
		runStreamManager:    m.runStreamManager,
		handler:             m.handler,
		pluginContextGetter: m.pluginContextGetter,
	}, nil
}

// PluginPathRunner can handle streaming operations for channels belonging to plugin specific path.
type PluginPathRunner struct {
	path                string
	pluginID            string
	datasourceUID       string
	runStreamManager    *runstream.Manager
	handler             backend.StreamHandler
	pluginContextGetter PluginContextGetter
}

// OnSubscribe passes control to a plugin.
func (r *PluginPathRunner) OnSubscribe(ctx context.Context, user identity.Requester, e model.SubscribeEvent) (model.SubscribeReply, backend.SubscribeStreamStatus, error) {
	pCtx, err := r.pluginContextGetter.GetPluginContext(ctx, user, r.pluginID, r.datasourceUID, false)
	if err != nil {
		if errors.Is(err, plugins.ErrPluginNotRegistered) {
			logger.Error("Plugin context not found", "path", r.path)
			return model.SubscribeReply{}, 0, centrifuge.ErrorInternal
		}
		logger.Error("Get plugin context error", "error", err, "path", r.path)
		return model.SubscribeReply{}, 0, err
	}
	resp, err := r.handler.SubscribeStream(ctx, &backend.SubscribeStreamRequest{
		PluginContext: pCtx,
		Path:          r.path,
		Data:          e.Data,
	})
	if err != nil {
		logger.Error("Plugin OnSubscribe call error", "error", err, "path", r.path)
		return model.SubscribeReply{}, 0, err
	}
	if resp.Status != backend.SubscribeStreamStatusOK {
		return model.SubscribeReply{}, resp.Status, nil
	}

	submitResult, err := r.runStreamManager.SubmitStream(ctx, user, orgchannel.PrependOrgID(user.GetOrgID(), e.Channel), r.path, e.Data, pCtx, r.handler, false)
	if err != nil {
		logger.Error("Error submitting stream to manager", "error", err, "path", r.path)
		return model.SubscribeReply{}, 0, centrifuge.ErrorInternal
	}
	if submitResult.StreamExists {
		logger.Debug("Skip running new stream (already exists)", "path", r.path)
	} else {
		logger.Debug("Running a new unidirectional stream", "path", r.path)
	}

	reply := model.SubscribeReply{
		Presence: true,
	}
	if resp.InitialData != nil {
		reply.Data = resp.InitialData.Data()
	}
	return reply, backend.SubscribeStreamStatusOK, nil
}

// OnPublish passes control to a plugin.
func (r *PluginPathRunner) OnPublish(ctx context.Context, user identity.Requester, e model.PublishEvent) (model.PublishReply, backend.PublishStreamStatus, error) {
	pCtx, err := r.pluginContextGetter.GetPluginContext(ctx, user, r.pluginID, r.datasourceUID, false)
	if err != nil {
		if errors.Is(err, plugins.ErrPluginNotRegistered) {
			logger.Error("Plugin context not found", "path", r.path)
			return model.PublishReply{}, 0, centrifuge.ErrorInternal
		}
		logger.Error("Get plugin context error", "error", err, "path", r.path)
		return model.PublishReply{}, 0, err
	}
	resp, err := r.handler.PublishStream(ctx, &backend.PublishStreamRequest{
		PluginContext: pCtx,
		Path:          r.path,
		Data:          e.Data,
	})
	if err != nil {
		logger.Error("Plugin OnPublish call error", "error", err, "path", r.path)
		return model.PublishReply{}, 0, err
	}
	if resp.Status != backend.PublishStreamStatusOK {
		return model.PublishReply{}, resp.Status, nil
	}
	return model.PublishReply{Data: resp.Data}, backend.PublishStreamStatusOK, nil
}
