package wrapper

import (
	"context"
	"errors"
	"fmt"

	"github.com/davecgh/go-spew/spew"
	sdk "github.com/grafana/grafana-plugin-sdk-go"
	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/datasource"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

type grafanaAPI struct {
	logger log.Logger
}

func (s *grafanaAPI) QueryDatasource(ctx context.Context, req *datasource.QueryDatasourceRequest) (*datasource.QueryDatasourceResponse, error) {
	if len(req.Queries) == 0 {
		return nil, fmt.Errorf("zero queries found in datasource request")
	}
	spew.Dump(req)
	getDsInfo := &models.GetDataSourceByIdQuery{
		Id:    req.DatasourceId,
		OrgId: req.OrgId,
	}

	if err := bus.Dispatch(getDsInfo); err != nil {
		return nil, fmt.Errorf("Could not find datasource %v", err)
	}

	// Convert plugin-model (datasource) queries to tsdb queries
	queries := make([]*tsdb.Query, len(req.Queries))
	for i, query := range req.Queries {
		sj, err := simplejson.NewJson([]byte(query.ModelJson))
		if err != nil {
			return nil, err
		}
		queries[i] = &tsdb.Query{
			RefId:         query.RefId,
			IntervalMs:    query.IntervalMs,
			MaxDataPoints: query.MaxDataPoints,
			DataSource:    getDsInfo.Result,
			Model:         sj,
		}
	}

	timeRange := tsdb.NewTimeRange(req.TimeRange.FromRaw, req.TimeRange.ToRaw)
	tQ := &tsdb.TsdbQuery{
		TimeRange: timeRange,
		Queries:   queries,
	}

	// Execute the converted queries
	tsdbRes, err := tsdb.HandleRequest(ctx, getDsInfo.Result, tQ)
	if err != nil {
		return nil, err
	}
	spew.Dump("tesbRes", tsdbRes)
	// Convert tsdb results (map) to plugin-model/datasource (slice) results
	// Only error and Series responses mapped.
	results := make([]*datasource.QueryResult, len(tsdbRes.Results))
	resIdx := 0
	for refID, res := range tsdbRes.Results {
		qr := &datasource.QueryResult{
			RefId: refID,
		}
		if res.Error != nil {
			qr.Error = res.ErrorString
			results[resIdx] = qr
			resIdx++
			continue
		}

		encodedFrames := make([][]byte, len(res.Series))
		for sIdx, series := range res.Series {
			frame, err := tsdb.SeriesToFrame(series)
			if err != nil {
				return nil, err
			}
			encodedFrames[sIdx], err = dataframe.MarshalArrow(frame)
			if err != nil {
				return nil, err
			}
		}
		qr.Dataframes = encodedFrames
		results[resIdx] = qr

		resIdx++
	}
	return &datasource.QueryDatasourceResponse{Results: results}, nil
}

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

	pbQuery := &datasource.DatasourceRequest{
		Datasource: &datasource.DatasourceInfo{
			Name:                    ds.Name,
			Type:                    ds.Type,
			Url:                     ds.Url,
			Id:                      ds.Id,
			OrgId:                   ds.OrgId,
			JsonData:                string(jsonData),
			DecryptedSecureJsonData: ds.SecureJsonData.Decrypt(),
		},
		TimeRange: &datasource.TimeRange{
			FromRaw:     query.TimeRange.From,
			ToRaw:       query.TimeRange.To,
			ToEpochMs:   query.TimeRange.GetToAsMsEpoch(),
			FromEpochMs: query.TimeRange.GetFromAsMsEpoch(),
		},
		Queries: []*datasource.Query{},
	}

	for _, q := range query.Queries {
		modelJson, _ := q.Model.MarshalJSON()

		pbQuery.Queries = append(pbQuery.Queries, &datasource.Query{
			ModelJson:     string(modelJson),
			IntervalMs:    q.IntervalMs,
			RefId:         q.RefId,
			MaxDataPoints: q.MaxDataPoints,
		})
	}

	pbres, err := tw.DatasourcePlugin.Query(ctx, pbQuery, &grafanaAPI{logger: tw.logger})

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
			metaJson, err := simplejson.NewJson([]byte(r.MetaJson))
			if err != nil {
				tw.logger.Error("Error parsing JSON Meta field: " + err.Error())
			}
			qr.Meta = metaJson
		}
		qr.Dataframes = r.Dataframes

		res.Results[r.RefId] = qr
	}

	return res, nil
}

// func (tw *DatasourcePluginWrapperV2) mapTables(r *datasource.QueryResult) ([]*tsdb.Table, error) {
// 	var tables []*tsdb.Table
// 	for _, t := range r.GetTables() {
// 		mappedTable, err := tw.mapTable(t)
// 		if err != nil {
// 			return nil, err
// 		}
// 		tables = append(tables, mappedTable)
// 	}
// 	return tables, nil
// }

// func (tw *DatasourcePluginWrapperV2) mapTable(t *datasource.Table) (*tsdb.Table, error) {
// 	table := &tsdb.Table{}
// 	for _, c := range t.GetColumns() {
// 		table.Columns = append(table.Columns, tsdb.TableColumn{
// 			Text: c.Name,
// 		})
// 	}

// 	table.Rows = make([]tsdb.RowValues, 0)
// 	for _, r := range t.GetRows() {
// 		row := tsdb.RowValues{}
// 		for _, rv := range r.Values {
// 			mappedRw, err := tw.mapRowValue(rv)
// 			if err != nil {
// 				return nil, err
// 			}

// 			row = append(row, mappedRw)
// 		}
// 		table.Rows = append(table.Rows, row)
// 	}

// 	return table, nil
// }
// func (tw *DatasourcePluginWrapperV2) mapRowValue(rv *datasource.RowValue) (interface{}, error) {
// 	switch rv.Type {
// 	case datasource.RowValue_TYPE_NULL:
// 		return nil, nil
// 	case datasource.RowValue_TYPE_INT64:
// 		return rv.Int64Value, nil
// 	case datasource.RowValue_TYPE_BOOL:
// 		return rv.BoolValue, nil
// 	case datasource.RowValue_TYPE_STRING:
// 		return rv.StringValue, nil
// 	case datasource.RowValue_TYPE_DOUBLE:
// 		return rv.DoubleValue, nil
// 	case datasource.RowValue_TYPE_BYTES:
// 		return rv.BytesValue, nil
// 	default:
// 		return nil, fmt.Errorf("Unsupported row value %v from plugin", rv.Type)
// 	}
// }
