package models

import (
	"context"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/timberio/go-datemath"
)

// TSDBSubQuery represents a TSDB sub-query.
type TSDBSubQuery struct {
	RefID         string             `json:"refId"`
	Model         *simplejson.Json   `json:"model,omitempty"`
	DataSource    *models.DataSource `json:"datasource"`
	MaxDataPoints int64              `json:"maxDataPoints"`
	IntervalMS    int64              `json:"intervalMs"`
	QueryType     string             `json:"queryType"`
}

// TSDBQuery contains all information about a TSDB query request.
type TSDBQuery struct {
	TimeRange *TSDBTimeRange
	Queries   []TSDBSubQuery
	Headers   map[string]string
	Debug     bool
	User      *models.SignedInUser
}

type TSDBTimeRange struct {
	From string
	To   string
	now  time.Time
}

type TSDBTable struct {
	Columns []TSDBTableColumn `json:"columns"`
	Rows    []TSDBRowValues   `json:"rows"`
}

type TSDBTableColumn struct {
	Text string `json:"text"`
}

type TSDBTimePoint [2]null.Float
type TSDBTimeSeriesPoints []TSDBTimePoint
type TSDBTimeSeriesSlice []TSDBTimeSeries
type TSDBRowValues []interface{}

type TSDBQueryResult struct {
	Error       error               `json:"-"`
	ErrorString string              `json:"error,omitempty"`
	RefID       string              `json:"refId"`
	Meta        *simplejson.Json    `json:"meta,omitempty"`
	Series      TSDBTimeSeriesSlice `json:"series"`
	Tables      []TSDBTable         `json:"tables"`
	Dataframes  DataFrames          `json:"dataframes"`
}

type TSDBTimeSeries struct {
	Name   string               `json:"name"`
	Points TSDBTimeSeriesPoints `json:"points"`
	Tags   map[string]string    `json:"tags,omitempty"`
}

type TSDBResponse struct {
	Results map[string]TSDBQueryResult `json:"results"`
	Message string                     `json:"message,omitempty"`
}

type TSDBPlugin interface {
	TSDBQuery(ctx context.Context, ds *models.DataSource, query TSDBQuery) (TSDBResponse, error)
}

func NewTSDBTimeRange(from, to string) TSDBTimeRange {
	return TSDBTimeRange{
		From: from,
		To:   to,
		now:  time.Now(),
	}
}

func (tr *TSDBTimeRange) GetFromAsMsEpoch() int64 {
	return tr.MustGetFrom().UnixNano() / int64(time.Millisecond)
}

func (tr *TSDBTimeRange) GetFromAsSecondsEpoch() int64 {
	return tr.GetFromAsMsEpoch() / 1000
}

func (tr *TSDBTimeRange) GetFromAsTimeUTC() time.Time {
	return tr.MustGetFrom().UTC()
}

func (tr *TSDBTimeRange) GetToAsMsEpoch() int64 {
	return tr.MustGetTo().UnixNano() / int64(time.Millisecond)
}

func (tr *TSDBTimeRange) GetToAsSecondsEpoch() int64 {
	return tr.GetToAsMsEpoch() / 1000
}

func (tr *TSDBTimeRange) GetToAsTimeUTC() time.Time {
	return tr.MustGetTo().UTC()
}

func (tr *TSDBTimeRange) MustGetFrom() time.Time {
	res, err := tr.ParseFrom()
	if err != nil {
		return time.Unix(0, 0)
	}
	return res
}

func (tr *TSDBTimeRange) MustGetTo() time.Time {
	res, err := tr.ParseTo()
	if err != nil {
		return time.Unix(0, 0)
	}
	return res
}

func (tr TSDBTimeRange) ParseFrom() (time.Time, error) {
	return parseTimeRange(tr.From, tr.now, false, nil)
}

func (tr TSDBTimeRange) ParseTo() (time.Time, error) {
	return parseTimeRange(tr.To, tr.now, true, nil)
}

func (tr TSDBTimeRange) ParseFromWithLocation(location *time.Location) (time.Time, error) {
	return parseTimeRange(tr.From, tr.now, false, location)
}

func (tr TSDBTimeRange) ParseToWithLocation(location *time.Location) (time.Time, error) {
	return parseTimeRange(tr.To, tr.now, true, location)
}

func parseTimeRange(s string, now time.Time, withRoundUp bool, location *time.Location) (time.Time, error) {
	if val, err := strconv.ParseInt(s, 10, 64); err == nil {
		seconds := val / 1000
		nano := (val - seconds*1000) * 1000000
		return time.Unix(seconds, nano), nil
	}

	diff, err := time.ParseDuration("-" + s)
	if err != nil {
		options := []func(*datemath.Options){
			datemath.WithNow(now),
			datemath.WithRoundUp(withRoundUp),
		}
		if location != nil {
			options = append(options, datemath.WithLocation(location))
		}

		return datemath.ParseAndEvaluate(s, options...)
	}

	return now.Add(diff), nil
}

// SeriesToFrame converts a TSDBTimeSeries to an SDK frame.
func SeriesToFrame(series TSDBTimeSeries) (*data.Frame, error) {
	timeVec := make([]*time.Time, len(series.Points))
	floatVec := make([]*float64, len(series.Points))
	for idx, point := range series.Points {
		timeVec[idx], floatVec[idx] = convertTSDBTimePoint(point)
	}
	frame := data.NewFrame(series.Name,
		data.NewField("time", nil, timeVec),
		data.NewField("value", data.Labels(series.Tags), floatVec),
	)

	return frame, nil
}

// convertTSDBTimePoint converts a TSDBTimePoint into two values appropriate
// for Series values.
func convertTSDBTimePoint(point TSDBTimePoint) (t *time.Time, f *float64) {
	timeIdx, valueIdx := 1, 0
	if point[timeIdx].Valid { // Assuming valid is null?
		tI := int64(point[timeIdx].Float64)
		uT := time.Unix(tI/int64(1e+3), (tI%int64(1e+3))*int64(1e+6)) // time.Time from millisecond unix ts
		t = &uT
	}
	if point[valueIdx].Valid {
		f = &point[valueIdx].Float64
	}
	return
}
