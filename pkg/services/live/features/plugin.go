package features

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/live/leader"
	"github.com/grafana/grafana/pkg/services/live/orgchannel"
	"github.com/grafana/grafana/pkg/services/live/runstream"

	"github.com/centrifugal/centrifuge"
	"github.com/gofrs/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

//go:generate mockgen -destination=plugin_mock.go -package=features github.com/grafana/grafana/pkg/services/live/features PluginContextGetter

type PluginContextGetter interface {
	GetPluginContext(user *models.SignedInUser, pluginID string, datasourceUID string, skipCache bool) (backend.PluginContext, bool, error)
}

type SubscribeStreamCaller interface {
	CallPluginSubscribeStream(ctx context.Context, user *models.SignedInUser, channel string, leaderNodeID string, leadershipID string) (models.SubscribeReply, backend.SubscribeStreamStatus, error)
}

type NodeIDGetter interface {
	GetNodeID() string
}

// PluginRunner can handle streaming operations for channels belonging to plugins.
type PluginRunner struct {
	pluginID              string
	datasourceUID         string
	pluginContextGetter   PluginContextGetter
	handler               backend.StreamHandler
	runStreamManager      *runstream.Manager
	leaderManager         leader.Manager
	subscribeStreamCaller SubscribeStreamCaller
	nodeIDGetter          NodeIDGetter
}

// NewPluginRunner creates new PluginRunner.
func NewPluginRunner(pluginID string, datasourceUID string, runStreamManager *runstream.Manager,
	pluginContextGetter PluginContextGetter, handler backend.StreamHandler,
	leaderManager leader.Manager, subscribeStreamCaller SubscribeStreamCaller, nodeIDGetter NodeIDGetter,
) *PluginRunner {
	return &PluginRunner{
		pluginID:              pluginID,
		datasourceUID:         datasourceUID,
		pluginContextGetter:   pluginContextGetter,
		handler:               handler,
		runStreamManager:      runStreamManager,
		leaderManager:         leaderManager,
		subscribeStreamCaller: subscribeStreamCaller,
		nodeIDGetter:          nodeIDGetter,
	}
}

// GetHandlerForPath gets the handler for a path.
func (m *PluginRunner) GetHandlerForPath(path string) (models.ChannelHandler, error) {
	return &PluginPathRunner{
		path:                  path,
		pluginID:              m.pluginID,
		datasourceUID:         m.datasourceUID,
		runStreamManager:      m.runStreamManager,
		handler:               m.handler,
		pluginContextGetter:   m.pluginContextGetter,
		leaderManager:         m.leaderManager,
		subscribeStreamCaller: m.subscribeStreamCaller,
		nodeIDGetter:          m.nodeIDGetter,
	}, nil
}

// PluginPathRunner can handle streaming operations for channels belonging to plugin specific path.
type PluginPathRunner struct {
	path                  string
	pluginID              string
	datasourceUID         string
	runStreamManager      *runstream.Manager
	handler               backend.StreamHandler
	pluginContextGetter   PluginContextGetter
	leaderManager         leader.Manager
	subscribeStreamCaller SubscribeStreamCaller
	nodeIDGetter          NodeIDGetter
}

// OnSubscribe passes control to a plugin.
func (r *PluginPathRunner) OnSubscribe(ctx context.Context, user *models.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	pCtx, found, err := r.pluginContextGetter.GetPluginContext(user, r.pluginID, r.datasourceUID, false)
	if err != nil {
		logger.Error("Get plugin context error", "error", err, "path", r.path)
		return models.SubscribeReply{}, 0, err
	}
	if !found {
		logger.Error("Plugin context not found", "path", r.path)
		return models.SubscribeReply{}, 0, centrifuge.ErrorInternal
	}

	if r.leaderManager != nil && !e.OnLeader {
		return r.handleHASubscribe(ctx, user, e)
	}

	resp, err := r.handler.SubscribeStream(ctx, &backend.SubscribeStreamRequest{
		PluginContext: pCtx,
		Path:          r.path,
	})
	if err != nil {
		logger.Error("Plugin OnSubscribe call error", "error", err, "path", r.path)
		return models.SubscribeReply{}, 0, err
	}
	if resp.Status != backend.SubscribeStreamStatusOK {
		return models.SubscribeReply{}, resp.Status, nil
	}

	submitResult, err := r.runStreamManager.SubmitStream(ctx, user, orgchannel.PrependOrgID(user.OrgId, e.Channel), r.path, pCtx, r.handler, e.LeadershipID, false)
	if err != nil {
		logger.Error("Error submitting stream to manager", "error", err, "path", r.path)
		return models.SubscribeReply{}, 0, centrifuge.ErrorInternal
	}
	if submitResult.StreamExists {
		logger.Debug("Skip running new stream (already exists)", "path", r.path)
	} else {
		logger.Debug("Running a new unidirectional stream", "path", r.path)
	}

	reply := models.SubscribeReply{
		Presence: true,
	}
	if resp.InitialData != nil {
		reply.Data = resp.InitialData.Data()
	}

	return reply, backend.SubscribeStreamStatusOK, nil
}

func (r *PluginPathRunner) handleHASubscribe(ctx context.Context, user *models.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	logger.Debug("Handle ha subscribe", "path", r.path, "currentNodeId", r.nodeIDGetter.GetNodeID())
	uid, err := uuid.NewV4()
	if err != nil {
		logger.Error("Error generating uuid v4", "error", err, "path", r.path)
		return models.SubscribeReply{}, 0, err
	}
	// TODO: support OrgID!!!
	orgChannel := orgchannel.PrependOrgID(user.OrgId, e.Channel)
	leaderNodeID, leadershipID, err := r.leaderManager.GetOrCreateLeader(ctx, orgChannel, r.nodeIDGetter.GetNodeID(), uid.String())
	if err != nil {
		logger.Error("Error on upsert channel leader", "error", err, "path", r.path, "orgChannel", orgChannel)
		return models.SubscribeReply{}, 0, err
	}
	logger.Debug("Channel leader found", "leaderNodeId", leaderNodeID)
	reply, status, err := r.subscribeStreamCaller.CallPluginSubscribeStream(ctx, user, e.Channel, leaderNodeID, leadershipID)
	if err != nil {
		logger.Error("Call plugin subscribe stream survey error", "error", err, "path", r.path)
		return models.SubscribeReply{}, 0, err
	}
	if status != backend.SubscribeStreamStatusOK {
		return models.SubscribeReply{}, status, nil
	}
	logger.Debug("Subscribe reply from leader received", "reply", reply)
	return reply, status, nil
}

// OnPublish passes control to a plugin.
func (r *PluginPathRunner) OnPublish(ctx context.Context, user *models.SignedInUser, e models.PublishEvent) (models.PublishReply, backend.PublishStreamStatus, error) {
	pCtx, found, err := r.pluginContextGetter.GetPluginContext(user, r.pluginID, r.datasourceUID, false)
	if err != nil {
		logger.Error("Get plugin context error", "error", err, "path", r.path)
		return models.PublishReply{}, 0, err
	}
	if !found {
		logger.Error("Plugin context not found", "path", r.path)
		return models.PublishReply{}, 0, centrifuge.ErrorInternal
	}
	resp, err := r.handler.PublishStream(ctx, &backend.PublishStreamRequest{
		PluginContext: pCtx,
		Path:          r.path,
		Data:          e.Data,
	})
	if err != nil {
		logger.Error("Plugin OnPublish call error", "error", err, "path", r.path)
		return models.PublishReply{}, 0, err
	}
	if resp.Status != backend.PublishStreamStatusOK {
		return models.PublishReply{}, resp.Status, nil
	}
	return models.PublishReply{Data: resp.Data}, backend.PublishStreamStatusOK, nil
}
