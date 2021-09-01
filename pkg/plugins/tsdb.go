package plugins

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/timberio/go-datemath"
)

// DataSubQuery represents a data sub-query.  New work should use the plugin SDK.
type DataSubQuery struct {
	RefID         string             `json:"refId"`
	Model         *simplejson.Json   `json:"model,omitempty"`
	DataSource    *models.DataSource `json:"datasource"`
	MaxDataPoints int64              `json:"maxDataPoints"`
	IntervalMS    int64              `json:"intervalMs"`
	QueryType     string             `json:"queryType"`
}

// DataQuery contains all information about a data query request.  New work should use the plugin SDK.
type DataQuery struct {
	TimeRange *DataTimeRange
	Queries   []DataSubQuery
	Headers   map[string]string
	Debug     bool
	User      *models.SignedInUser
}

type DataTimeRange struct {
	From string
	To   string
	Now  time.Time
}

type DataTable struct {
	Columns []DataTableColumn `json:"columns"`
	Rows    []DataRowValues   `json:"rows"`
}

type DataTableColumn struct {
	Text string `json:"text"`
}

type DataTimePoint [2]null.Float
type DataTimeSeriesPoints []DataTimePoint
type DataTimeSeriesSlice []DataTimeSeries
type DataRowValues []interface{}

// Deprecated: DataQueryResult should use backend.QueryDataResponse
type DataQueryResult struct {
	Error       error               `json:"-"`
	ErrorString string              `json:"error,omitempty"`
	RefID       string              `json:"refId"`
	Meta        *simplejson.Json    `json:"meta,omitempty"`
	Series      DataTimeSeriesSlice `json:"series"`
	Tables      []DataTable         `json:"tables"`
	Dataframes  DataFrames          `json:"dataframes"`
}

// UnmarshalJSON deserializes a DataQueryResult from JSON.
//
// Deserialization support is required by tests.
func (r *DataQueryResult) UnmarshalJSON(b []byte) error {
	m := map[string]interface{}{}
	if err := json.Unmarshal(b, &m); err != nil {
		return err
	}

	refID, ok := m["refId"].(string)
	if !ok {
		return fmt.Errorf("can't decode field refId - not a string")
	}
	var meta *simplejson.Json
	if m["meta"] != nil {
		mm, ok := m["meta"].(map[string]interface{})
		if !ok {
			return fmt.Errorf("can't decode field meta - not a JSON object")
		}
		meta = simplejson.NewFromAny(mm)
	}
	var series DataTimeSeriesSlice
	/* TODO
	if m["series"] != nil {
	}
	*/
	var tables []DataTable
	if m["tables"] != nil {
		ts, ok := m["tables"].([]interface{})
		if !ok {
			return fmt.Errorf("can't decode field tables - not an array of Tables")
		}
		for _, ti := range ts {
			tm, ok := ti.(map[string]interface{})
			if !ok {
				return fmt.Errorf("can't decode field tables - not an array of Tables")
			}
			var columns []DataTableColumn
			cs, ok := tm["columns"].([]interface{})
			if !ok {
				return fmt.Errorf("can't decode field tables - not an array of Tables")
			}
			for _, ci := range cs {
				cm, ok := ci.(map[string]interface{})
				if !ok {
					return fmt.Errorf("can't decode field tables - not an array of Tables")
				}
				val, ok := cm["text"].(string)
				if !ok {
					return fmt.Errorf("can't decode field tables - not an array of Tables")
				}

				columns = append(columns, DataTableColumn{Text: val})
			}

			rs, ok := tm["rows"].([]interface{})
			if !ok {
				return fmt.Errorf("can't decode field tables - not an array of Tables")
			}
			var rows []DataRowValues
			for _, ri := range rs {
				vals, ok := ri.([]interface{})
				if !ok {
					return fmt.Errorf("can't decode field tables - not an array of Tables")
				}
				rows = append(rows, vals)
			}

			tables = append(tables, DataTable{
				Columns: columns,
				Rows:    rows,
			})
		}
	}

	var dfs *dataFrames
	if m["dataframes"] != nil {
		raw, ok := m["dataframes"].([]interface{})
		if !ok {
			return fmt.Errorf("can't decode field dataframes - not an array of byte arrays")
		}

		var encoded [][]byte
		for _, ra := range raw {
			encS, ok := ra.(string)
			if !ok {
				return fmt.Errorf("can't decode field dataframes - not an array of byte arrays")
			}
			enc, err := base64.StdEncoding.DecodeString(encS)
			if err != nil {
				return fmt.Errorf("can't decode field dataframes - not an array of arrow frames")
			}
			encoded = append(encoded, enc)
		}
		decoded, err := data.UnmarshalArrowFrames(encoded)
		if err != nil {
			return err
		}
		dfs = &dataFrames{
			decoded: decoded,
			encoded: encoded,
		}
	}

	r.RefID = refID
	r.Meta = meta
	r.Series = series
	r.Tables = tables
	if dfs != nil {
		r.Dataframes = dfs
	}
	return nil
}

// DataTimeSeries -- this structure is deprecated, all new work should use DataFrames from the SDK
type DataTimeSeries struct {
	Name   string               `json:"name"`
	Points DataTimeSeriesPoints `json:"points"`
	Tags   map[string]string    `json:"tags,omitempty"`
}

// Deprecated: DataResponse -- this structure is deprecated, all new work should use backend.QueryDataResponse
type DataResponse struct {
	Results map[string]DataQueryResult `json:"results"`
	Message string                     `json:"message,omitempty"`
}

// ToBackendDataResponse converts the legacy format to the standard SDK format
func (r DataResponse) ToBackendDataResponse() (*backend.QueryDataResponse, error) {
	qdr := &backend.QueryDataResponse{
		Responses: make(map[string]backend.DataResponse, len(r.Results)),
	}

	// Convert tsdb results (map) to plugin-model/datasource (slice) results.
	// Only error, Series, and encoded Dataframes responses are mapped.
	for refID, res := range r.Results {
		pRes := backend.DataResponse{}
		if res.Error != nil {
			pRes.Error = res.Error
		}

		if res.Dataframes != nil {
			decoded, err := res.Dataframes.Decoded()
			if err != nil {
				return qdr, err
			}
			pRes.Frames = decoded
			qdr.Responses[refID] = pRes
			continue
		}

		for _, series := range res.Series {
			frame, err := SeriesToFrame(series)
			if err != nil {
				return nil, err
			}
			frame.RefID = refID
			pRes.Frames = append(pRes.Frames, frame)
		}

		qdr.Responses[refID] = pRes
	}
	return qdr, nil
}

// Deprecated: use the plugin SDK
type DataPlugin interface {
	DataQuery(ctx context.Context, ds *models.DataSource, query DataQuery) (DataResponse, error)
}

type DataPluginFunc func(ctx context.Context, ds *models.DataSource, query DataQuery) (DataResponse, error)

func (f DataPluginFunc) DataQuery(ctx context.Context, ds *models.DataSource, query DataQuery) (DataResponse, error) {
	return f(ctx, ds, query)
}

func NewDataTimeRange(from, to string) DataTimeRange {
	return DataTimeRange{
		From: from,
		To:   to,
		Now:  time.Now(),
	}
}

func (tr *DataTimeRange) GetFromAsMsEpoch() int64 {
	return tr.MustGetFrom().UnixNano() / int64(time.Millisecond)
}

func (tr *DataTimeRange) GetFromAsSecondsEpoch() int64 {
	return tr.GetFromAsMsEpoch() / 1000
}

func (tr *DataTimeRange) GetFromAsTimeUTC() time.Time {
	return tr.MustGetFrom().UTC()
}

func (tr *DataTimeRange) GetToAsMsEpoch() int64 {
	return tr.MustGetTo().UnixNano() / int64(time.Millisecond)
}

func (tr *DataTimeRange) GetToAsSecondsEpoch() int64 {
	return tr.GetToAsMsEpoch() / 1000
}

func (tr *DataTimeRange) GetToAsTimeUTC() time.Time {
	return tr.MustGetTo().UTC()
}

func (tr *DataTimeRange) MustGetFrom() time.Time {
	res, err := tr.ParseFrom()
	if err != nil {
		return time.Unix(0, 0)
	}
	return res
}

func (tr *DataTimeRange) MustGetTo() time.Time {
	res, err := tr.ParseTo()
	if err != nil {
		return time.Unix(0, 0)
	}
	return res
}

func (tr DataTimeRange) ParseFrom() (time.Time, error) {
	return parseTimeRange(tr.From, tr.Now, false, nil)
}

func (tr DataTimeRange) ParseTo() (time.Time, error) {
	return parseTimeRange(tr.To, tr.Now, true, nil)
}

func (tr DataTimeRange) ParseFromWithLocation(location *time.Location) (time.Time, error) {
	return parseTimeRange(tr.From, tr.Now, false, location)
}

func (tr DataTimeRange) ParseToWithLocation(location *time.Location) (time.Time, error) {
	return parseTimeRange(tr.To, tr.Now, true, location)
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

// SeriesToFrame converts a DataTimeSeries to an SDK frame.
func SeriesToFrame(series DataTimeSeries) (*data.Frame, error) {
	timeVec := make([]*time.Time, len(series.Points))
	floatVec := make([]*float64, len(series.Points))
	for idx, point := range series.Points {
		timeVec[idx], floatVec[idx] = convertDataTimePoint(point)
	}
	frame := data.NewFrame(series.Name,
		data.NewField("time", nil, timeVec),
		data.NewField("value", data.Labels(series.Tags), floatVec),
	)

	return frame, nil
}

// convertDataTimePoint converts a DataTimePoint into two values appropriate
// for Series values.
func convertDataTimePoint(point DataTimePoint) (t *time.Time, f *float64) {
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
