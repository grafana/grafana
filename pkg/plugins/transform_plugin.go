package plugins

import (
	"context"
	"encoding/json"
	"fmt"
	"path"
	"strconv"

	sdkgrpcplugin "github.com/grafana/grafana-plugin-sdk-go/backend/grpcplugin"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
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

	cmd := ComposePluginStartCommand(p.Executable)
	fullpath := path.Join(p.PluginDir, cmd)
	factory := grpcplugin.NewBackendPlugin(p.Id, fullpath, grpcplugin.PluginStartFuncs{
		OnStart: p.onPluginStart,
	})
	if err := backendPluginManager.Register(p.Id, factory); err != nil {
		return errutil.Wrapf(err, "Failed to register backend plugin")
	}

	Transform = p

	return nil
}

func (p *TransformPlugin) onPluginStart(pluginID string, client *grpcplugin.Client, logger log.Logger) error {
	p.TransformWrapper = NewTransformWrapper(logger, client.TransformPlugin)

	if client.DataPlugin != nil {
		tsdb.RegisterTsdbQueryEndpoint(pluginID, func(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
			return wrapper.NewDatasourcePluginWrapperV2(logger, p.Id, p.Type, client.DataPlugin), nil
		})
	}

	return nil
}

// ...
// Wrapper Code
// ...

func NewTransformWrapper(log log.Logger, plugin sdkgrpcplugin.TransformClient) *TransformWrapper {
	return &TransformWrapper{plugin, log, &transformCallback{log}}
}

type TransformWrapper struct {
	sdkgrpcplugin.TransformClient
	logger   log.Logger
	callback *transformCallback
}

func (tw *TransformWrapper) Transform(ctx context.Context, query *tsdb.TsdbQuery) (*tsdb.Response, error) {
	pbQuery := &pluginv2.QueryDataRequest{
		PluginContext: &pluginv2.PluginContext{
			// TODO: Things probably
		},
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
			QueryType:     q.QueryType,
			TimeRange: &pluginv2.TimeRange{
				ToEpochMS:   query.TimeRange.GetToAsMsEpoch(),
				FromEpochMS: query.TimeRange.GetFromAsMsEpoch(),
			},
		})
	}
	pbRes, err := tw.TransformClient.TransformData(ctx, pbQuery, tw.callback)
	if err != nil {
		return nil, err
	}

	tR := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult, len(pbRes.Responses)),
	}
	for refID, res := range pbRes.Responses {
		tRes := &tsdb.QueryResult{
			RefId:      refID,
			Dataframes: tsdb.NewEncodedDataFrames(res.Frames),
		}
		if len(res.JsonMeta) != 0 {
			tRes.Meta = simplejson.NewFromAny(res.JsonMeta)
		}
		if res.Error != "" {
			tRes.Error = fmt.Errorf(res.Error)
			tRes.ErrorString = res.Error
		}
		tR.Results[refID] = tRes
	}

	return tR, nil
}

type transformCallback struct {
	logger log.Logger
}

func (s *transformCallback) QueryData(ctx context.Context, req *pluginv2.QueryDataRequest) (*pluginv2.QueryDataResponse, error) {
	if len(req.Queries) == 0 {
		return nil, fmt.Errorf("zero queries found in datasource request")
	}

	datasourceID := int64(0)

	if req.PluginContext.DataSourceInstanceSettings != nil {
		datasourceID = req.PluginContext.DataSourceInstanceSettings.Id
	}

	getDsInfo := &models.GetDataSourceByIdQuery{
		OrgId: req.PluginContext.OrgId,
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
			QueryType:     query.QueryType,
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
	responses := make(map[string]*pluginv2.DataResponse, len(tsdbRes.Results))
	for refID, res := range tsdbRes.Results {
		pRes := &pluginv2.DataResponse{}
		if res.Error != nil {
			pRes.Error = res.Error.Error()
		}

		if res.Dataframes != nil {
			encoded, err := res.Dataframes.Encoded()
			if err != nil {
				return nil, err
			}
			pRes.Frames = encoded
			responses[refID] = pRes
			continue
		}

		for _, series := range res.Series {
			frame, err := tsdb.SeriesToFrame(series)
			frame.RefID = refID
			if err != nil {
				return nil, err
			}
			encFrame, err := frame.MarshalArrow()
			if err != nil {
				return nil, err
			}
			pRes.Frames = append(pRes.Frames, encFrame)
		}
		if res.Meta != nil {
			b, err := res.Meta.MarshalJSON()
			if err != nil {
				s.logger.Error("failed to marshal json metadata", err)
			}
			pRes.JsonMeta = b
		}
		responses[refID] = pRes
	}
	return &pluginv2.QueryDataResponse{
		Responses: responses,
	}, nil
}
