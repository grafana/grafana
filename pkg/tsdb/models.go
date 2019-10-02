package tsdb

import (
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

type TsdbQuery struct {
	TimeRange *TimeRange
	Queries   []*Query
	Debug     bool
}

type Query struct {
	RefId         string
	Model         *simplejson.Json
	DataSource    *models.DataSource
	MaxDataPoints int64
	IntervalMs    int64
}

type Response struct {
	Results map[string]*QueryResult `json:"results"`
	Message string                  `json:"message,omitempty"`
}

type QueryResult struct {
	Error       error            `json:"-"`
	ErrorString string           `json:"error,omitempty"`
	RefId       string           `json:"refId"`
	Meta        *simplejson.Json `json:"meta,omitempty"`
	Series      TimeSeriesSlice  `json:"series"`
	Tables      []*Table         `json:"tables"`
}

type TimeSeries struct {
	Name   string            `json:"name"`
	Points TimeSeriesPoints  `json:"points"`
	Tags   map[string]string `json:"tags,omitempty"`
}

type Table struct {
	Columns []TableColumn `json:"columns"`
	Rows    []RowValues   `json:"rows"`
}

type TableColumn struct {
	Text string `json:"text"`
}

type RowValues []interface{}
type TimePoint [2]null.Float
type TimeSeriesPoints []TimePoint
type TimeSeriesSlice []*TimeSeries

func NewQueryResult() *QueryResult {
	return &QueryResult{
		Series: make(TimeSeriesSlice, 0),
	}
}

func NewTimePoint(value null.Float, timestamp float64) TimePoint {
	return TimePoint{value, null.FloatFrom(timestamp)}
}

func NewTimeSeriesPointsFromArgs(values ...float64) TimeSeriesPoints {
	points := make(TimeSeriesPoints, 0)

	for i := 0; i < len(values); i += 2 {
		points = append(points, NewTimePoint(null.FloatFrom(values[i]), values[i+1]))
	}

	return points
}

func NewTimeSeries(name string, points TimeSeriesPoints) *TimeSeries {
	return &TimeSeries{
		Name:   name,
		Points: points,
	}
}
