package testdatasource

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

var modeValueAsRow = "values-as-rows"
var modeValueAsFields = "values-as-fields"
var modeValueAsLabeledFields = "values-as-labeled-fields"
var modeTimeseries = "timeseries"
var modeTimeseriesWide = "timeseries-wide"

var allStateCodes = []string{"AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "MD", "MA", "MI", "MN", "MS", "MO", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"}

type usaQueryWrapper struct {
	USA usaQuery `json:"usa"`
}

type usaQuery struct {
	Mode   string   `json:"mode"`
	Period string   `json:"period"`
	Fields []string `json:"fields"`
	States []string `json:"states"`

	// From the main query
	maxDataPoints int64
	timeRange     backend.TimeRange
	interval      time.Duration
	period        time.Duration
}

func (s *Service) handleUSAScenario(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		wrapper := &usaQueryWrapper{}
		err := json.Unmarshal(q.JSON, wrapper)
		if err != nil {
			return nil, fmt.Errorf("failed to parse query json: %v", err)
		}

		usa := wrapper.USA
		periodString := usa.Period
		if periodString == "" {
			periodString = "30m"
		}
		period, err := time.ParseDuration(periodString)
		if err != nil {
			return nil, fmt.Errorf("failed to parse query json: %v", err)
		}

		if len(usa.Fields) == 0 {
			usa.Fields = []string{"foo", "bar", "baz"}
		}
		if len(usa.States) == 0 {
			usa.States = allStateCodes
		}

		usa.period = period
		usa.maxDataPoints = q.MaxDataPoints * 2
		usa.timeRange = q.TimeRange
		usa.interval = q.Interval

		resp.Responses[q.RefID] = doStateQuery(usa)
	}

	return resp, nil
}

func doStateQuery(query usaQuery) backend.DataResponse {
	switch query.Mode {
	default:
	case modeTimeseries:
		return getStateValueAsTimeseries(query, false)
	case modeTimeseriesWide:
		return getStateValueAsTimeseries(query, true)
	case modeValueAsFields:
		return getStateValueAsFrame(query.timeRange.To, query, false)
	case modeValueAsLabeledFields:
		return getStateValueAsFrame(query.timeRange.To, query, true)
	}
	return getStateValueAsRow(query.timeRange.To, query)
}

func getStateValueAsFrame(t time.Time, query usaQuery, asLabel bool) backend.DataResponse {
	dr := backend.DataResponse{}

	var labels data.Labels
	for _, fname := range query.Fields {
		frame := data.NewFrame(fname)
		vals := getStateValues(t, fname, query)
		for idx, state := range query.States {
			name := state
			if asLabel {
				labels = data.Labels{"state": state}
				name = ""
			}
			field := data.NewField(name, labels, []float64{vals[idx]})
			frame.Fields = append(frame.Fields, field)
		}
		dr.Frames = append(dr.Frames, frame)
	}
	return dr
}

// One frame for each time+value
func getStateValueAsTimeseries(query usaQuery, wide bool) backend.DataResponse {
	dr := backend.DataResponse{}
	tr := query.timeRange

	var labels data.Labels
	for _, fname := range query.Fields {
		timeWalkerMs := tr.From.UnixNano() / int64(time.Millisecond)
		to := tr.To.UnixNano() / int64(time.Millisecond)
		stepMillis := query.interval.Milliseconds()

		// Calculate all values
		timeVals := make([]time.Time, 0)
		stateVals := make([][]float64, 0)
		for i := int64(0); i < query.maxDataPoints && timeWalkerMs < to; i++ {
			t := time.Unix(timeWalkerMs/int64(1e+3), (timeWalkerMs%int64(1e+3))*int64(1e+6)).UTC()

			vals := getStateValues(t, fname, query)
			timeVals = append(timeVals, t)
			stateVals = append(stateVals, vals)

			timeWalkerMs += stepMillis
		}

		values := make([]float64, len(timeVals))
		for idx, state := range query.States {
			for i := 0; i < len(timeVals); i++ {
				values[i] = stateVals[i][idx]
			}

			labels = data.Labels{"state": state}
			frame := data.NewFrame(fname,
				data.NewField(data.TimeSeriesTimeFieldName, nil, timeVals),
				data.NewField(data.TimeSeriesValueFieldName, labels, values),
			)
			dr.Frames = append(dr.Frames, frame)
		}
	}

	// Stick them next to eachother
	if wide {
		wideFrame := data.NewFrame("", dr.Frames[0].Fields[0])
		for _, frame := range dr.Frames {
			field := frame.Fields[1]
			field.Name = frame.Name
			wideFrame.Fields = append(wideFrame.Fields, field)
		}
		dr.Frames = data.Frames{wideFrame}
	}

	return dr
}

func getStateValueAsRow(t time.Time, query usaQuery) backend.DataResponse {
	frame := data.NewFrame("", data.NewField("state", nil, query.States))
	for _, f := range query.Fields {
		frame.Fields = append(frame.Fields, data.NewField(f, nil, getStateValues(t, f, query)))
	}

	return backend.DataResponse{
		Frames: data.Frames{frame},
	}
}

func getStateValues(t time.Time, field string, query usaQuery) []float64 {
	tv := float64(t.UnixNano())
	pn := float64(query.period.Nanoseconds())
	incr := pn / float64(len(query.States))

	fn := math.Sin

	// period offsets
	switch field {
	case "bar":
		fn = math.Cos
	case "baz":
		fn = math.Tan
	}

	values := make([]float64, len(query.States))
	for i := range query.States {
		tv += incr
		value := fn(float64(int64(tv) % int64(pn)))
		// We shall truncate float64 to a certain precision, because otherwise we might
		// get different cos/tan results across different CPU architectures and compilers.
		values[i] = float64(int(value*1e10)) / 1e10
	}
	return values
}
