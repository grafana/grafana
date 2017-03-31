package tsdb

import (
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

type Query struct {
	RefId         string
	Model         *simplejson.Json
	Depends       []string
	DataSource    *models.DataSource
	Results       []*TimeSeries
	Exclude       bool
	MaxDataPoints int64
	IntervalMs    int64
}

type QuerySlice []*Query

type Request struct {
	TimeRange *TimeRange
	Queries   QuerySlice
}

type Response struct {
	BatchTimings []*BatchTiming          `json:"timings"`
	Results      map[string]*QueryResult `json:"results"`
}

type BatchTiming struct {
	TimeElapsed int64
}

type BatchResult struct {
	Error        error
	QueryResults map[string]*QueryResult
	Timings      *BatchTiming
}

func (br *BatchResult) WithError(err error) *BatchResult {
	br.Error = err
	return br
}

type QueryResult struct {
	Error       error           `json:"-"`
	ErrorString string          `json:"error"`
	RefId       string          `json:"refId"`
	Series      TimeSeriesSlice `json:"series"`
}

type TimeSeries struct {
	Name   string            `json:"name"`
	Points TimeSeriesPoints  `json:"points"`
	Tags   map[string]string `json:"tags"`
}

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
