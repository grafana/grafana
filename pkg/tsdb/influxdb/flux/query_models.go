package flux

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/datasource"
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

func GetQueryModel(query backend.DataQuery) (*queryModel, error) {
	model := &queryModel{}

	err := json.Unmarshal(query.JSON, &model)
	if err != nil {
		return nil, fmt.Errorf("error reading query: %s", err.Error())
	}

	// Copy directly from the well typed query
	model.TimeRange = query.TimeRange
	model.MaxDataPoints = query.MaxDataPoints
	model.Interval = query.Interval
	return model, nil
}

// getQueryModelTSDB builds a queryModel from plugins.DataQuery information and datasource configuration (dsInfo).
func getQueryModelTSDB(query backend.DataQuery, timeRange backend.TimeRange,
	dsInfo *datasource.Info) (*queryModel, error) {
	model := &queryModel{}
	if err := json.Unmarshal(query.JSON, &model); err != nil {
		return nil, fmt.Errorf("error reading query: %w", err)
	}
	if model.Options.DefaultBucket == "" {
		model.Options.DefaultBucket = dsInfo.DefaultBucket
	}
	if model.Options.Bucket == "" {
		model.Options.Bucket = model.Options.DefaultBucket
	}
	if model.Options.Organization == "" {
		model.Options.Organization = dsInfo.Organization
	}

	// Copy directly from the well typed query
	model.TimeRange = timeRange
	model.MaxDataPoints = query.MaxDataPoints
	if model.MaxDataPoints == 0 {
		model.MaxDataPoints = 10000 // 10k/series should be a reasonable place to abort!
	}
	model.Interval = time.Millisecond * query.Interval
	if model.Interval.Milliseconds() == 0 {
		model.Interval = time.Millisecond // 1ms
	}
	return model, nil
}
