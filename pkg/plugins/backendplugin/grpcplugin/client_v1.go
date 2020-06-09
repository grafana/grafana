package grpcplugin

import (
	"context"

	datasourceV1 "github.com/grafana/grafana-plugin-model/go/datasource"
	rendererV1 "github.com/grafana/grafana-plugin-model/go/renderer"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/hashicorp/go-plugin"
)

type clientV1 struct {
	logger log.Logger
	datasourceV1.DatasourcePlugin
	rendererV1.RendererPlugin
}

func newClientV1(descriptor PluginDescriptor, logger log.Logger, rpcClient plugin.ClientProtocol) (pluginClient, error) {
	logger.Warn("Plugin uses a deprecated version of Grafana's backend plugin system which will be removed in a future release. " +
		"Consider upgrading to a newer plugin version or reach out to the plugin repository/developer and request an upgrade.")

	raw, err := rpcClient.Dispense(descriptor.pluginID)
	if err != nil {
		return nil, err
	}

	c := clientV1{
		logger: logger,
	}
	if plugin, ok := raw.(datasourceV1.DatasourcePlugin); ok {
		c.DatasourcePlugin = instrumentDatasourcePluginV1(plugin)
	}

	if plugin, ok := raw.(rendererV1.RendererPlugin); ok {
		c.RendererPlugin = plugin
	}

	if descriptor.startFns.OnLegacyStart != nil {
		legacyClient := &backendplugin.LegacyClient{
			DatasourcePlugin: c.DatasourcePlugin,
			RendererPlugin:   c.RendererPlugin,
		}
		if err := descriptor.startFns.OnLegacyStart(descriptor.pluginID, legacyClient, logger); err != nil {
			return nil, err
		}
	}

	return &c, nil
}

func (c *clientV1) CollectMetrics(ctx context.Context) (*backend.CollectMetricsResult, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (c *clientV1) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (c *clientV1) CallResource(ctx context.Context, req *backend.CallResourceRequest) (backendplugin.CallResourceClientResponseStream, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

// func (c *clientV1) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
// 	instance := req.PluginContext.DataSourceInstanceSettings
// 	pbQuery := &datasourceV1.DatasourceRequest{
// 		Datasource: &datasource.DatasourceInfo{
// 			Name:                    instance.Name,
// 			Type:                    req.PluginContext.PluginID,
// 			Url:                     instance.URL,
// 			Id:                      instance.ID,
// 			OrgId:                   req.PluginContext.OrgID,
// 			JsonData:                string(instance.JSONData),
// 			DecryptedSecureJsonData: instance.DecryptedSecureJSONData,
// 		},
// 		Queries: []*datasource.Query{},
// 	}

// 	if len(req.Queries) > 0 {
// 		pbQuery.TimeRange = &datasource.TimeRange{
// 			FromEpochMs: req.Queries[0].TimeRange.From.UnixNano() / int64(time.Millisecond),
// 			ToEpochMs:   req.Queries[0].TimeRange.To.UnixNano() / int64(time.Millisecond),
// 			FromRaw:     string(req.Queries[0].TimeRange.From.UnixNano() / int64(time.Millisecond)),
// 			ToRaw:       string(req.Queries[0].TimeRange.To.UnixNano() / int64(time.Millisecond)),
// 		}
// 	}

// 	for _, q := range req.Queries {
// 		pbQuery.Queries = append(pbQuery.Queries, &datasourceV1.Query{
// 			ModelJson:     string(q.JSON),
// 			IntervalMs:    q.Interval.Milliseconds(),
// 			RefId:         q.RefID,
// 			MaxDataPoints: q.MaxDataPoints,
// 		})
// 	}

// 	pbres, err := c.DatasourcePlugin.Query(ctx, pbQuery)
// 	if err != nil {
// 		return nil, err
// 	}

// 	resp := backend.NewQueryDataResponse()
// 	for _, r := range pbres.Results {
// 		dr := backend.DataResponse{
// 			Frames: data.Frames{},
// 		}

// 		if r.Error != "" {
// 			dr.Error = errors.New(r.Error)
// 		}

// 		for _, s := range r.GetSeries() {
// 			timeVec := make([]*time.Time, len(s.Points))
// 			floatVec := make([]*float64, len(s.Points))
// 			for idx, p := range s.Points {
// 				po := tsdb.NewTimePoint(null.FloatFrom(p.Value), float64(p.Timestamp))
// 				timeVec[idx], floatVec[idx] = convertTSDBTimePoint(po)
// 			}

// 			frame := data.NewFrame(s.Name,
// 				data.NewField("time", nil, timeVec),
// 				data.NewField("value", data.Labels(s.Tags), floatVec),
// 			)

// 			if r.MetaJson != "" {
// 				var metaMap map[string]interface{}
// 				if err := json.Unmarshal([]byte(r.MetaJson), &metaMap); err != nil {
// 					c.logger.Error("Error parsing JSON Meta field: " + err.Error())
// 				} else {
// 					frame.Meta.Custom = metaMap
// 				}
// 			}

// 			dr.Frames = append(dr.Frames, frame)
// 		}

// 		for _, t := range r.GetTables() {
// 			frame := data.NewFrame(r.RefId)

// 			for _, c := range t.GetColumns() {
// 				values := []interface{}{}
// 				for _, r := range t.GetRows() {
// 					for _, rv := range r.GetValues() {
// 						switch rv.Kind {
// 						case datasource.RowValue_TYPE_NULL:
// 							var str *string
// 							values = append(values, str)
// 						case datasource.RowValue_TYPE_INT64:
// 							values = append(values, rv.Int64Value)
// 						case datasource.RowValue_TYPE_BOOL:
// 							values = append(values, rv.BoolValue)
// 						case datasource.RowValue_TYPE_STRING:
// 							values = append(values, rv.StringValue)
// 						case datasource.RowValue_TYPE_DOUBLE:
// 							values = append(values, rv.DoubleValue)
// 						case datasource.RowValue_TYPE_BYTES:
// 							values = append(values, string(rv.BytesValue))
// 						}
// 					}
// 				}
// 				frame.Fields = append(frame.Fields, data.NewField(c.Name, nil, values))
// 			}
// 		}

// 		resp.Responses[r.RefId] = dr
// 	}

// 	return resp, nil
// }

// // convertTSDBTimePoint coverts a tsdb.TimePoint into two values appropriate
// // for Series values.
// func convertTSDBTimePoint(point tsdb.TimePoint) (t *time.Time, f *float64) {
// 	timeIdx, valueIdx := 1, 0
// 	if point[timeIdx].Valid { // Assuming valid is null?
// 		tI := int64(point[timeIdx].Float64)
// 		uT := time.Unix(tI/int64(1e+3), (tI%int64(1e+3))*int64(1e+6)) // time.Time from millisecond unix ts
// 		t = &uT
// 	}
// 	if point[valueIdx].Valid {
// 		f = &point[valueIdx].Float64
// 	}
// 	return
// }

type datasourceV1QueryFunc func(ctx context.Context, req *datasourceV1.DatasourceRequest) (*datasourceV1.DatasourceResponse, error)

func (fn datasourceV1QueryFunc) Query(ctx context.Context, req *datasourceV1.DatasourceRequest) (*datasourceV1.DatasourceResponse, error) {
	return fn(ctx, req)
}

func instrumentDatasourcePluginV1(plugin datasourceV1.DatasourcePlugin) datasourceV1.DatasourcePlugin {
	if plugin == nil {
		return nil
	}

	return datasourceV1QueryFunc(func(ctx context.Context, req *datasourceV1.DatasourceRequest) (*datasourceV1.DatasourceResponse, error) {
		var resp *datasourceV1.DatasourceResponse
		err := backendplugin.InstrumentQueryDataRequest(req.Datasource.Type, func() (innerErr error) {
			resp, innerErr = plugin.Query(ctx, req)
			return
		})
		return resp, err
	})
}
