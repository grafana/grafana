package flux

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/tsdb/interval"
)

// queryOptions represents datasource configuration options
type queryOptions struct {
	Bucket        string `json:"bucket"`
	DefaultBucket string `json:"defaultBucket"`
	Organization  string `json:"organization"`
}

// queryModel represents a query.
type queryModel struct {
	RawQuery string       `json:"query"`
	Options  queryOptions `json:"options"`

	// Not from JSON
	TimeRange     backend.TimeRange `json:"-"`
	MaxDataPoints int64             `json:"-"`
	Interval      time.Duration     `json:"-"`
}

// The following is commented out but kept as it should be useful when
// restoring this code to be closer to the SDK's models.

// func GetQueryModel(query backend.DataQuery) (*queryModel, error) {
// 	model := &queryModel{}

// 	err := json.Unmarshal(query.JSON, &model)
// 	if err != nil {
// 		return nil, fmt.Errorf("error reading query: %s", err.Error())
// 	}

// 	// Copy directly from the well typed query
// 	model.TimeRange = query.TimeRange
// 	model.MaxDataPoints = query.MaxDataPoints
// 	model.Interval = query.Interval
// 	return model, nil
// }

// to get the interval-value, there are two possibilities:
// - either it is available as `IntervalMS` (happens when we executing a query)
// - it is not available as `IntervalMS` and then we calculate it from
//   stored minInterval value (happens when alerting)
func getInterval(query plugins.DataSubQuery, timeRange plugins.DataTimeRange,
	dsInfo *models.DataSource) (time.Duration, error) {
	// when executing a query we get the real interval value in query.intervalMS
	intervalMS := query.IntervalMS

	if intervalMS != 0 {
		return (time.Millisecond * time.Duration(intervalMS)), nil
	}

	// if that is not available, we are probably being called for alerting
	// so we need to calculate an interval-value from the minInterval
	// that we have stored.
	defaultMinInterval := time.Millisecond * 1
	minInterval, err := interval.GetIntervalFrom(dsInfo, query.Model, defaultMinInterval)
	if err != nil {
		return time.Duration(0), fmt.Errorf("error reading minInterval: %w", err)
	}

	calc := interval.NewCalculator(interval.CalculatorOptions{MinInterval: defaultMinInterval})

	// NOTE: interval.Calculate does some work that is unnecessary for us:
	// - takes timestamps-as-strings and converts them into numbers (we already have those numbers)
	// - returns both a duration and a text-formatted-duration (we only need the duration)
	// unfortunately there is no direct access to the math-calculation that happens
	// inside, so we have to accept the overhead
	return calc.Calculate(timeRange, minInterval).Value, nil
}

// getQueryModelTSDB builds a queryModel from plugins.DataQuery information and datasource configuration (dsInfo).
func getQueryModelTSDB(query plugins.DataSubQuery, timeRange plugins.DataTimeRange,
	dsInfo *models.DataSource) (*queryModel, error) {
	model := &queryModel{}
	queryBytes, err := query.Model.Encode()
	if err != nil {
		return nil, fmt.Errorf("failed to re-encode the flux query into JSON: %w", err)
	}

	if err := json.Unmarshal(queryBytes, &model); err != nil {
		return nil, fmt.Errorf("error reading query: %w", err)
	}
	if model.Options.DefaultBucket == "" {
		model.Options.DefaultBucket = dsInfo.JsonData.Get("defaultBucket").MustString("")
	}
	if model.Options.Bucket == "" {
		model.Options.Bucket = model.Options.DefaultBucket
	}
	if model.Options.Organization == "" {
		model.Options.Organization = dsInfo.JsonData.Get("organization").MustString("")
	}

	startTime, err := timeRange.ParseFrom()
	if err != nil && timeRange.From != "" {
		return nil, fmt.Errorf("error reading startTime: %w", err)
	}

	endTime, err := timeRange.ParseTo()
	if err != nil && timeRange.To != "" {
		return nil, fmt.Errorf("error reading endTime: %w", err)
	}

	// Copy directly from the well typed query
	model.TimeRange = backend.TimeRange{
		From: startTime,
		To:   endTime,
	}
	model.MaxDataPoints = query.MaxDataPoints
	if model.MaxDataPoints == 0 {
		model.MaxDataPoints = 10000 // 10k/series should be a reasonable place to abort!
	}

	interval, err := getInterval(query, timeRange, dsInfo)
	if err != nil {
		return nil, err
	}

	model.Interval = interval

	return model, nil
}
