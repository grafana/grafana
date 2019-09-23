package grafana

import (
	"context"
	"encoding/json"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/datasource"
	plugin "github.com/hashicorp/go-plugin"
)

type TimeRange struct {
	From time.Time
	To   time.Time
}

type DatasourceInfo struct {
	ID       int64
	OrgID    int64
	Name     string
	Type     string
	URL      string
	JSONData json.RawMessage
}

type Point struct {
	Timestamp time.Time
	Value     float64
}

type Query struct {
	RefID         string
	MaxDataPoints int64
	Interval      time.Duration
	ModelJSON     json.RawMessage
}

type QueryResult struct {
	Error      string
	RefID      string
	MetaJSON   string
	DataFrames []*dataframe.DataFrame
}

type DatasourceHandler interface {
	Query(ctx context.Context, tr TimeRange, ds DatasourceInfo, queries []Query) ([]QueryResult, error)
}

// datasourcePluginWrapper converts to and from protobuf types.
type datasourcePluginWrapper struct {
	plugin.NetRPCUnsupportedPlugin

	handler DatasourceHandler
}

func (p *datasourcePluginWrapper) Query(ctx context.Context, req *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	tr := TimeRange{
		From: time.Unix(0, req.TimeRange.FromEpochMs*int64(time.Millisecond)),
		To:   time.Unix(0, req.TimeRange.FromEpochMs*int64(time.Millisecond)),
	}

	dsi := DatasourceInfo{
		ID:       req.Datasource.Id,
		OrgID:    req.Datasource.OrgId,
		Name:     req.Datasource.Name,
		Type:     req.Datasource.Type,
		URL:      req.Datasource.Url,
		JSONData: json.RawMessage(req.Datasource.JsonData),
	}

	var queries []Query
	for _, q := range req.Queries {
		queries = append(queries, Query{
			RefID:         q.RefId,
			MaxDataPoints: q.MaxDataPoints,
			Interval:      time.Duration(q.IntervalMs) * time.Millisecond,
			ModelJSON:     []byte(q.ModelJson),
		})
	}

	results, err := p.handler.Query(ctx, tr, dsi, queries)
	if err != nil {
		return nil, err
	}

	if len(results) == 0 {
		return &datasource.DatasourceResponse{
			Results: []*datasource.QueryResult{},
		}, nil
	}

	var respResults []*datasource.QueryResult

	for _, res := range results {
		var tss []*datasource.TimeSeries
		var tbs []*datasource.Table

		for _, df := range res.DataFrames {
			if len(df.Fields) == 0 {
				continue
			}

			timeIdx := indexOfFieldType(df, dataframe.FieldTypeTime)

			// If one of the fields is of type time, return a time series,
			// otherwise return a table.
			if timeIdx >= 0 {
				tss = append(tss, asTimeSeries(df))
			} else {
				tbs = append(tbs, asTable(df))
			}
		}

		queryResult := &datasource.QueryResult{
			Error:    res.Error,
			RefId:    res.RefID,
			MetaJson: res.MetaJSON,
			Series:   tss,
			Tables:   tbs,
		}

		respResults = append(respResults, queryResult)
	}

	return &datasource.DatasourceResponse{
		Results: respResults,
	}, nil
}

func asTimeSeries(df *dataframe.DataFrame) *datasource.TimeSeries {
	timeIdx := indexOfFieldType(df, dataframe.FieldTypeTime)
	timeVec := df.Fields[timeIdx].Vector

	valueIdx := indexOfFieldType(df, dataframe.FieldTypeNumber)
	valueVec := df.Fields[valueIdx].Vector

	pts := []*datasource.Point{}
	for i := 0; i < timeVec.Len(); i++ {
		t := timeVec.At(i).Time()
		v := valueVec.At(i).Float()

		pts = append(pts, &datasource.Point{
			Timestamp: int64(t.UnixNano()) / int64(time.Millisecond),
			Value:     v,
		})
	}

	return &datasource.TimeSeries{
		Name:   df.Name,
		Tags:   df.Labels,
		Points: pts,
	}
}

func asTable(df *dataframe.DataFrame) *datasource.Table {

	ncols := len(df.Fields)
	nrows := df.Fields[0].Len()
	rows := make([]*datasource.TableRow, nrows)

	for i := 0; i < nrows; i++ {
		rowvals := make([]*datasource.RowValue, ncols)
		for j, f := range df.Fields {
			switch f.Type {
			case dataframe.FieldTypeNumber:
				rowvals[j] = &datasource.RowValue{
					Kind:        datasource.RowValue_TYPE_DOUBLE,
					DoubleValue: f.Vector.At(i).Float(),
				}
			case dataframe.FieldTypeString:
				rowvals[j] = &datasource.RowValue{
					Kind:        datasource.RowValue_TYPE_STRING,
					StringValue: f.Vector.At(i).String(),
				}
			}
		}

		rows[i] = &datasource.TableRow{
			Values: rowvals,
		}
	}

	var cols []*datasource.TableColumn
	for _, f := range df.Fields {
		cols = append(cols, &datasource.TableColumn{Name: f.Name})
	}

	return &datasource.Table{
		Columns: cols,
		Rows:    rows,
	}
}

func indexOfFieldType(df *dataframe.DataFrame, t dataframe.FieldType) int {
	for idx, f := range df.Fields {
		if f.Type == t {
			return idx
		}
	}
	return -1
}
