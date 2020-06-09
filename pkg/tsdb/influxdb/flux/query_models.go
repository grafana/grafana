package flux

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

// QueryOptions represents datasource configuration options
type QueryOptions struct {
	Bucket        string `json:"bucket"`
	DefaultBucket string `json:"defaultBucket"`
	Organization  string `json:"organization"`
}

// QueryModel represents a spreadsheet query.
type QueryModel struct {
	RawQuery string       `json:"query"`
	Options  QueryOptions `json:"options"`

	// Not from JSON
	TimeRange     backend.TimeRange `json:"-"`
	MaxDataPoints int64             `json:"-"`
	Interval      time.Duration     `json:"-"`
}

// The following is commented out but kept as it should be useful when
// restoring this code to be closer to the SDK's models.

// func GetQueryModel(query backend.DataQuery) (*QueryModel, error) {
// 	model := &QueryModel{}

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

// GetQueryModelTSDB builds a QueryModel from tsdb.Query information and datasource configuration (dsInfo).
func GetQueryModelTSDB(query *tsdb.Query, timeRange *tsdb.TimeRange, dsInfo *models.DataSource) (*QueryModel, error) {
	model := &QueryModel{}
	queryBytes, err := query.Model.Encode()
	if err != nil {
		return nil, fmt.Errorf("failed to re-encode the flux query into JSON: %w", err)
	}

	err = json.Unmarshal(queryBytes, &model)
	if err != nil {
		return nil, fmt.Errorf("error reading query: %s", err.Error())
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
	if err != nil {
		return nil, err
	}

	endTime, err := timeRange.ParseTo()
	if err != nil {
		return nil, err
	}

	// Copy directly from the well typed query
	model.TimeRange = backend.TimeRange{
		From: startTime,
		To:   endTime,
	}
	model.MaxDataPoints = query.MaxDataPoints
	model.Interval = time.Millisecond * time.Duration(query.IntervalMs)
	return model, nil
}
