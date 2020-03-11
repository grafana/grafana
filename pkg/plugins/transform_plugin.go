package plugins

import (
	"context"
	"encoding/json"
	"fmt"
	"path"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/datasource/wrapper"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/util/errutil"
)

type TransformPlugin struct {
	PluginBase

	Executable string `json:"executable,omitempty"`

	*TransformWrapper
}

func (p *TransformPlugin) Load(decoder *json.Decoder, pluginDir string, backendPluginManager backendplugin.Manager) error {
	if err := decoder.Decode(p); err != nil {
		return err
	}

	if err := p.registerPlugin(pluginDir); err != nil {
		return err
	}

	cmd := ComposePluginStartCommmand(p.Executable)
	fullpath := path.Join(p.PluginDir, cmd)
	descriptor := backendplugin.NewBackendPluginDescriptor(p.Id, fullpath, backendplugin.PluginStartFuncs{
		OnStart: p.onPluginStart,
	})
	if err := backendPluginManager.Register(descriptor); err != nil {
		return errutil.Wrapf(err, "Failed to register backend plugin")
	}

	Transform = p

	return nil
}

func (p *TransformPlugin) onPluginStart(pluginID string, client *backendplugin.Client, logger log.Logger) error {
	p.TransformWrapper = NewTransformWrapper(logger, client.TransformPlugin)

	if client.CorePlugin != nil {
		tsdb.RegisterTsdbQueryEndpoint(pluginID, func(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
			return wrapper.NewDatasourcePluginWrapperV2(logger, p.Id, p.Type, client.CorePlugin), nil
		})
	}

	return nil
}

// ...
// Wrapper Code
// ...

func NewTransformWrapper(log log.Logger, plugin backendplugin.TransformPlugin) *TransformWrapper {
	return &TransformWrapper{plugin, log, &transformCallback{log}}
}

type TransformWrapper struct {
	backendplugin.TransformPlugin
	logger   log.Logger
	callback *transformCallback
}

func (tw *TransformWrapper) Transform(ctx context.Context, query *tsdb.TsdbQuery) (*tsdb.Response, error) {
	pbQuery := &pluginv2.DataQueryRequest{
		Config:  &pluginv2.PluginConfig{},
		Queries: []*pluginv2.DataQuery{},
	}

	for _, q := range query.Queries {
		modelJSON, err := q.Model.MarshalJSON()
		if err != nil {
			return nil, err
		}
		pbQuery.Queries = append(pbQuery.Queries, &pluginv2.DataQuery{
			Json:          modelJSON,
			IntervalMS:    q.IntervalMs,
			RefId:         q.RefId,
			MaxDataPoints: q.MaxDataPoints,
			TimeRange: &pluginv2.TimeRange{
				ToEpochMS:   query.TimeRange.GetToAsMsEpoch(),
				FromEpochMS: query.TimeRange.GetFromAsMsEpoch(),
			},
		})
	}
	pbRes, err := tw.TransformPlugin.DataQuery(ctx, pbQuery, tw.callback)
	if err != nil {
		return nil, err
	}

	return &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{
			"": {
				Dataframes: pbRes.Frames,
				Meta:       simplejson.NewFromAny(pbRes.Metadata),
			},
		},
	}, nil
}

type transformCallback struct {
	logger log.Logger
}

func (s *transformCallback) DataQuery(ctx context.Context, req *pluginv2.DataQueryRequest) (*pluginv2.DataQueryResponse, error) {
	if len(req.Queries) == 0 {
		return nil, fmt.Errorf("zero queries found in datasource request")
	}

	datasourceID := int64(0)

	if req.Config.DatasourceConfig != nil {
		datasourceID = req.Config.DatasourceConfig.Id
	}

	getDsInfo := &models.GetDataSourceByIdQuery{
		OrgId: req.Config.OrgId,
		Id:    datasourceID,
	}

	if err := bus.Dispatch(getDsInfo); err != nil {
		return nil, fmt.Errorf("Could not find datasource %v", err)
	}

	// Convert plugin-model (datasource) queries to tsdb queries
	queries := make([]*tsdb.Query, len(req.Queries))
	for i, query := range req.Queries {
		sj, err := simplejson.NewJson(query.Json)
		if err != nil {
			return nil, err
		}
		queries[i] = &tsdb.Query{
			RefId:         query.RefId,
			IntervalMs:    query.IntervalMS,
			MaxDataPoints: query.MaxDataPoints,
			DataSource:    getDsInfo.Result,
			Model:         sj,
		}
	}

	// For now take Time Range from first query.
	timeRange := tsdb.NewTimeRange(strconv.FormatInt(req.Queries[0].TimeRange.FromEpochMS, 10), strconv.FormatInt(req.Queries[0].TimeRange.ToEpochMS, 10))

	tQ := &tsdb.TsdbQuery{
		TimeRange: timeRange,
		Queries:   queries,
	}

	// Execute the converted queries
	tsdbRes, err := tsdb.HandleRequest(ctx, getDsInfo.Result, tQ)
	if err != nil {
		return nil, err
	}
	// Convert tsdb results (map) to plugin-model/datasource (slice) results.
	// Only error, tsdb.Series, and encoded Dataframes responses are mapped.

	encodedFrames := [][]byte{}
	for refID, res := range tsdbRes.Results {

		if res.Error != nil {
			// TODO add Errors property to Frame
			encodedFrames = append(encodedFrames, nil)
			continue
		}

		if res.Dataframes != nil {
			encodedFrames = append(encodedFrames, res.Dataframes...)
			continue
		}

		for _, series := range res.Series {
			frame, err := tsdb.SeriesToFrame(series)
			frame.RefID = refID
			if err != nil {
				return nil, err
			}
			encFrame, err := dataframe.MarshalArrow(frame)
			if err != nil {
				return nil, err
			}
			encodedFrames = append(encodedFrames, encFrame)
		}
	}
	return &pluginv2.DataQueryResponse{Frames: encodedFrames}, nil
}
