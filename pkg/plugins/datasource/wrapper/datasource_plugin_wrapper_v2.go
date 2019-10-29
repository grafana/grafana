package wrapper

import (
	"context"
	"errors"

	sdk "github.com/grafana/grafana-plugin-sdk-go/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

// type grafanaAPI struct {
// 	logger log.Logger
// }

// func (s *grafanaAPI) QueryDatasource(ctx context.Context, req *pluginv2.QueryDatasourceRequest) (*pluginv2.QueryDatasourceResponse, error) {
// 	if len(req.Queries) == 0 {
// 		return nil, fmt.Errorf("zero queries found in datasource request")
// 	}
// 	getDsInfo := &models.GetDataSourceByIdQuery{
// 		Id:    req.DatasourceId,
// 		OrgId: req.OrgId,
// 	}

// 	if err := bus.Dispatch(getDsInfo); err != nil {
// 		return nil, fmt.Errorf("Could not find datasource %v", err)
// 	}

// 	// Convert plugin-model (datasource) queries to tsdb queries
// 	queries := make([]*tsdb.Query, len(req.Queries))
// 	for i, query := range req.Queries {
// 		sj, err := simplejson.NewJson([]byte(query.ModelJson))
// 		if err != nil {
// 			return nil, err
// 		}
// 		queries[i] = &tsdb.Query{
// 			RefId:         query.RefId,
// 			IntervalMs:    query.IntervalMs,
// 			MaxDataPoints: query.MaxDataPoints,
// 			DataSource:    getDsInfo.Result,
// 			Model:         sj,
// 		}
// 	}

// 	timeRange := tsdb.NewTimeRange(req.TimeRange.FromRaw, req.TimeRange.ToRaw)
// 	tQ := &tsdb.TsdbQuery{
// 		TimeRange: timeRange,
// 		Queries:   queries,
// 	}

// 	// Execute the converted queries
// 	tsdbRes, err := tsdb.HandleRequest(ctx, getDsInfo.Result, tQ)
// 	if err != nil {
// 		return nil, err
// 	}
// 	// Convert tsdb results (map) to plugin-model/datasource (slice) results
// 	// Only error and Series responses mapped.
// 	results := make([]*pluginv2.QueryResult, len(tsdbRes.Results))
// 	resIdx := 0
// 	for refID, res := range tsdbRes.Results {
// 		qr := &pluginv2.QueryResult{
// 			RefId: refID,
// 		}
// 		if res.Error != nil {
// 			qr.Error = res.ErrorString
// 			results[resIdx] = qr
// 			resIdx++
// 			continue
// 		}

// 		encodedFrames := make([][]byte, len(res.Series))
// 		for sIdx, series := range res.Series {
// 			frame, err := tsdb.SeriesToFrame(series)
// 			if err != nil {
// 				return nil, err
// 			}
// 			encodedFrames[sIdx], err = dataframe.MarshalArrow(frame)
// 			if err != nil {
// 				return nil, err
// 			}
// 		}
// 		qr.Dataframes = encodedFrames
// 		results[resIdx] = qr

// 		resIdx++
// 	}
// 	return &pluginv2.QueryDatasourceResponse{Results: results}, nil
// }

func NewDatasourcePluginWrapperV2(log log.Logger, plugin sdk.DatasourcePlugin) *DatasourcePluginWrapperV2 {
	return &DatasourcePluginWrapperV2{DatasourcePlugin: plugin, logger: log}
}

type DatasourcePluginWrapperV2 struct {
	sdk.DatasourcePlugin
	logger log.Logger
}

func (tw *DatasourcePluginWrapperV2) Query(ctx context.Context, ds *models.DataSource, query *tsdb.TsdbQuery) (*tsdb.Response, error) {
	jsonData, err := ds.JsonData.MarshalJSON()
	if err != nil {
		return nil, err
	}

	pbQuery := &pluginv2.DatasourceRequest{
		Datasource: &pluginv2.DatasourceInfo{
			Name:                    ds.Name,
			Type:                    ds.Type,
			Url:                     ds.Url,
			Id:                      ds.Id,
			OrgId:                   ds.OrgId,
			JsonData:                string(jsonData),
			DecryptedSecureJsonData: ds.SecureJsonData.Decrypt(),
		},
		TimeRange: &pluginv2.TimeRange{
			FromRaw:     query.TimeRange.From,
			ToRaw:       query.TimeRange.To,
			ToEpochMs:   query.TimeRange.GetToAsMsEpoch(),
			FromEpochMs: query.TimeRange.GetFromAsMsEpoch(),
		},
		Queries: []*pluginv2.DatasourceQuery{},
	}

	for _, q := range query.Queries {
		modelJSON, err := q.Model.MarshalJSON()
		if err != nil {
			return nil, err
		}
		pbQuery.Queries = append(pbQuery.Queries, &pluginv2.DatasourceQuery{
			ModelJson:     string(modelJSON),
			IntervalMs:    q.IntervalMs,
			RefId:         q.RefId,
			MaxDataPoints: q.MaxDataPoints,
		})
	}

	pbres, err := tw.DatasourcePlugin.Query(ctx, pbQuery)

	if err != nil {
		return nil, err
	}

	res := &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{},
	}

	for _, r := range pbres.Results {
		qr := &tsdb.QueryResult{
			RefId: r.RefId,
		}

		if r.Error != "" {
			qr.Error = errors.New(r.Error)
			qr.ErrorString = r.Error
		}

		if r.MetaJson != "" {
			metaJSON, err := simplejson.NewJson([]byte(r.MetaJson))
			if err != nil {
				tw.logger.Error("Error parsing JSON Meta field: " + err.Error())
			}
			qr.Meta = metaJSON
		}
		qr.Dataframes = r.Dataframes

		res.Results[r.RefId] = qr
	}

	return res, nil
}
