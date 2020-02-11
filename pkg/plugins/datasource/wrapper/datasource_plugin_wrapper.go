package wrapper

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana-plugin-model/go/datasource"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

func NewDatasourcePluginWrapper(log log.Logger, plugin datasource.DatasourcePlugin) *DatasourcePluginWrapper {
	return &DatasourcePluginWrapper{DatasourcePlugin: plugin, logger: log}
}

type DatasourcePluginWrapper struct {
	datasource.DatasourcePlugin
	logger log.Logger
}

func (tw *DatasourcePluginWrapper) Query(ctx context.Context, ds *models.DataSource, query *tsdb.TsdbQuery) (*tsdb.Response, error) {
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

	pbres, err := tw.DatasourcePlugin.Query(ctx, pbQuery)

	if err != nil {
		return nil, err
	}

	res := &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{},
	}

	for _, r := range pbres.Results {
		qr := &tsdb.QueryResult{
			RefId:  r.RefId,
			Series: []*tsdb.TimeSeries{},
			Tables: []*tsdb.Table{},
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

		for _, s := range r.GetSeries() {
			points := tsdb.TimeSeriesPoints{}

			for _, p := range s.Points {
				po := tsdb.NewTimePoint(null.FloatFrom(p.Value), float64(p.Timestamp))
				points = append(points, po)
			}

			qr.Series = append(qr.Series, &tsdb.TimeSeries{
				Name:   s.Name,
				Tags:   s.Tags,
				Points: points,
			})
		}

		mappedTables, err := tw.mapTables(r)
		if err != nil {
			return nil, err
		}
		qr.Tables = mappedTables

		res.Results[r.RefId] = qr
	}

	return res, nil
}
func (tw *DatasourcePluginWrapper) mapTables(r *datasource.QueryResult) ([]*tsdb.Table, error) {
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

func (tw *DatasourcePluginWrapper) mapTable(t *datasource.Table) (*tsdb.Table, error) {
	table := &tsdb.Table{}
	for _, c := range t.GetColumns() {
		table.Columns = append(table.Columns, tsdb.TableColumn{
			Text: c.Name,
		})
	}

	table.Rows = make([]tsdb.RowValues, 0)
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
func (tw *DatasourcePluginWrapper) mapRowValue(rv *datasource.RowValue) (interface{}, error) {
	switch rv.Kind {
	case datasource.RowValue_TYPE_NULL:
		return nil, nil
	case datasource.RowValue_TYPE_INT64:
		return rv.Int64Value, nil
	case datasource.RowValue_TYPE_BOOL:
		return rv.BoolValue, nil
	case datasource.RowValue_TYPE_STRING:
		return rv.StringValue, nil
	case datasource.RowValue_TYPE_DOUBLE:
		return rv.DoubleValue, nil
	case datasource.RowValue_TYPE_BYTES:
		return rv.BytesValue, nil
	default:
		return nil, fmt.Errorf("Unsupported row value %v from plugin", rv.Kind)
	}
}
