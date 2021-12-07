package features

import (
	"context"
	"encoding/json"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/live/orgchannel"
	"github.com/grafana/grafana/pkg/services/live/runstream"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

//go:generate mockgen -destination=plugin_mock.go -package=features github.com/grafana/grafana/pkg/services/live/features PluginContextGetter

type PluginContextGetter interface {
	GetPluginContext(user *models.SignedInUser, pluginID string, datasourceUID string, skipCache bool) (backend.PluginContext, bool, error)
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
func (m *PluginRunner) GetHandlerForPath(path string) (models.ChannelHandler, error) {
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

type MetricRequest struct {
	From  string           `json:"from"`
	To    string           `json:"to"`
	Query *simplejson.Json `json:"query"`
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
	var query *backend.DataQuery
	if e.Data != nil {
		var mr MetricRequest
		err := json.Unmarshal(e.Data, &mr)
		if err != nil {
			logger.Error("Query extraction error", "error", err, "path", r.path, "data", string(e.Data))
			// TODO: looks like we need backend.SubscribeStreamStatusBadRequest.
			return models.SubscribeReply{}, 0, centrifuge.ErrorBadRequest
		}
		modelJSON, err := mr.Query.MarshalJSON()
		if err != nil {
			logger.Error("Error marshal query to JSON", "path", r.path, "error", err)
			return models.SubscribeReply{}, 0, centrifuge.ErrorInternal
		}
		timeRange := legacydata.NewDataTimeRange(mr.From, mr.To)

		query = &backend.DataQuery{
			TimeRange: backend.TimeRange{
				From: timeRange.GetFromAsTimeUTC(),
				To:   timeRange.GetToAsTimeUTC(),
			},
			RefID:         mr.Query.Get("refId").MustString("A"),
			MaxDataPoints: mr.Query.Get("maxDataPoints").MustInt64(100),
			Interval:      time.Duration(mr.Query.Get("intervalMs").MustInt64(1000)) * time.Millisecond,
			QueryType:     mr.Query.Get("queryType").MustString(""),
			JSON:          modelJSON,
		}
	}
	resp, err := r.handler.SubscribeStream(ctx, &backend.SubscribeStreamRequest{
		PluginContext: pCtx,
		Path:          r.path,
		Query:         query,
	})
	if err != nil {
		logger.Error("Plugin OnSubscribe call error", "error", err, "path", r.path)
		return models.SubscribeReply{}, 0, err
	}
	if resp.Status != backend.SubscribeStreamStatusOK {
		return models.SubscribeReply{}, resp.Status, nil
	}

	submitResult, err := r.runStreamManager.SubmitStream(ctx, user, orgchannel.PrependOrgID(user.OrgId, e.Channel), r.path, query, pCtx, r.handler, false)
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
