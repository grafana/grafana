package tsdb

import (
	"fmt"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	proto "github.com/grafana/grafana/pkg/tsdb/models"
	"golang.org/x/net/context"
)

func NewDatasourcePluginWrapper(log log.Logger, plugin TsdbPlugin) *DatasourcePluginWrapper {
	return &DatasourcePluginWrapper{TsdbPlugin: plugin, logger: log}
}

type DatasourcePluginWrapper struct {
	TsdbPlugin

	logger log.Logger
}

func (tw *DatasourcePluginWrapper) Query(ctx context.Context, ds *models.DataSource, query *tsdb.TsdbQuery) (*tsdb.Response, error) {
	jsonData, err := ds.JsonData.MarshalJSON()
	if err != nil {
		return nil, err
	}

	pbQuery := &proto.TsdbQuery{
		Datasource: &proto.DatasourceInfo{
			JsonData: string(jsonData),
			Name:     ds.Name,
			Type:     ds.Type,
			Url:      ds.Url,
			Id:       ds.Id,
			OrgId:    ds.OrgId,
		},
		TimeRange: &proto.TimeRange{
			FromRaw:     query.TimeRange.From,
			ToRaw:       query.TimeRange.To,
			ToEpochMs:   query.TimeRange.GetToAsMsEpoch(),
			FromEpochMs: query.TimeRange.GetFromAsMsEpoch(),
		},
		Queries: []*proto.Query{},
	}

	for _, q := range query.Queries {
		modelJson, _ := q.Model.MarshalJSON()

		pbQuery.Queries = append(pbQuery.Queries, &proto.Query{
			ModelJson:     string(modelJson),
			IntervalMs:    q.IntervalMs,
			RefId:         q.RefId,
			MaxDataPoints: q.MaxDataPoints,
		})
	}

	pbres, err := tw.TsdbPlugin.Query(ctx, pbQuery)

	if err != nil {
		return nil, err
	}

	res := &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{},
	}

	for _, r := range pbres.Results {
		res.Results[r.RefId] = &tsdb.QueryResult{
			RefId:  r.RefId,
			Series: []*tsdb.TimeSeries{},
		}

		for _, s := range r.GetSeries() {
			points := tsdb.TimeSeriesPoints{}

			for _, p := range s.Points {
				po := tsdb.NewTimePoint(null.FloatFrom(p.Value), float64(p.Timestamp))
				points = append(points, po)
			}

			res.Results[r.RefId].Series = append(res.Results[r.RefId].Series, &tsdb.TimeSeries{
				Name:   s.Name,
				Tags:   s.Tags,
				Points: points,
			})
		}

		mappedTables, err := tw.mapTables(r)
		if err != nil {
			return nil, err
		}
		res.Results[r.RefId].Tables = mappedTables
	}

	return res, nil
}
func (tw *DatasourcePluginWrapper) mapTables(r *proto.QueryResult) ([]*tsdb.Table, error) {
	var tables []*tsdb.Table
	for _, t := range r.GetTables() {
		mappedTable, err := tw.mapTable(t)
		if err != nil {
			return nil, err
		}
		tables = append(tables, mappedTable)
	}
	return tables, nil
}

func (tw *DatasourcePluginWrapper) mapTable(t *proto.Table) (*tsdb.Table, error) {
	table := &tsdb.Table{}
	for _, c := range t.GetColumns() {
		table.Columns = append(table.Columns, tsdb.TableColumn{
			Text: c.Name,
		})
	}

	for _, r := range t.GetRows() {
		row := tsdb.RowValues{}
		for _, rv := range r.Values {
			mappedRw, err := tw.mapRowValue(rv)
			if err != nil {
				return nil, err
			}

			row = append(row, mappedRw)
		}
		table.Rows = append(table.Rows, row)
	}

	return table, nil
}
func (tw *DatasourcePluginWrapper) mapRowValue(rv *proto.RowValue) (interface{}, error) {
	switch rv.Kind {
	case proto.RowValue_TYPE_NULL:
		return nil, nil
	case proto.RowValue_TYPE_INT64:
		return rv.Int64Value, nil
	case proto.RowValue_TYPE_BOOL:
		return rv.BoolValue, nil
	case proto.RowValue_TYPE_STRING:
		return rv.StringValue, nil
	case proto.RowValue_TYPE_DOUBLE:
		return rv.DoubleValue, nil
	case proto.RowValue_TYPE_BYTES:
		return rv.BytesValue, nil
	default:
		return nil, fmt.Errorf("Unsupported row value %v from plugin", rv.Kind)
	}
}
