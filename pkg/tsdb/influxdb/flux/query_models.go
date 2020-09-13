package flux

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
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

// getQueryModelTSDB builds a queryModel from tsdb.Query information and datasource configuration (dsInfo).
func getQueryModelTSDB(query *tsdb.Query, timeRange *tsdb.TimeRange, dsInfo *models.DataSource) (*queryModel, error) {
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
	model.Interval = time.Millisecond * time.Duration(query.IntervalMs)
	if model.Interval.Milliseconds() == 0 {
		model.Interval = time.Millisecond // 1ms
	}
	return model, nil
}
