package tsdb

import (
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

// TsdbQuery contains all information about a query request.
type TsdbQuery struct {
	TimeRange *TimeRange
	Queries   []*Query
	Headers   map[string]string
	Debug     bool
	User      *models.SignedInUser
}

type Query struct {
	RefId         string
	Model         *simplejson.Json
	DataSource    *models.DataSource
	MaxDataPoints int64
	IntervalMs    int64
	QueryType     string
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
	Dataframes  DataFrames       `json:"dataframes"`
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

type DataFrames interface {
	Encoded() ([][]byte, error)
	Decoded() (data.Frames, error)
}

type decodedDataFrames struct {
	decoded data.Frames
	encoded [][]byte
}

func NewDecodedDataFrames(decodedFrames data.Frames) DataFrames {
	return &decodedDataFrames{
		decoded: decodedFrames,
	}
}

func (ddf *decodedDataFrames) Encoded() ([][]byte, error) {
	if ddf.encoded == nil {
		encoded, err := ddf.decoded.MarshalArrow()
		if err != nil {
			return nil, err
		}
		ddf.encoded = encoded
	}

	return ddf.encoded, nil
}

func (ddf *decodedDataFrames) Decoded() (data.Frames, error) {
	return ddf.decoded, nil
}

func (ddf *decodedDataFrames) MarshalJSON() ([]byte, error) {
	encoded, err := ddf.Encoded()
	if err != nil {
		return nil, err
	}

	return json.Marshal(encoded)
}

type encodedDataFrames struct {
	encoded [][]byte
	decoded data.Frames
}

func NewEncodedDataFrames(encodedFrames [][]byte) DataFrames {
	return &encodedDataFrames{
		encoded: encodedFrames,
	}
}

func (edf *encodedDataFrames) Encoded() ([][]byte, error) {
	return edf.encoded, nil
}

func (edf *encodedDataFrames) Decoded() (data.Frames, error) {
	if edf.decoded == nil {
		decoded, err := data.UnmarshalArrowFrames(edf.encoded)
		if err != nil {
			return nil, err
		}
		edf.decoded = decoded
	}

	return edf.decoded, nil
}

func (edf *encodedDataFrames) MarshalJSON() ([]byte, error) {
	encoded, err := edf.Encoded()
	if err != nil {
		return nil, err
	}

	return json.Marshal(encoded)
}
