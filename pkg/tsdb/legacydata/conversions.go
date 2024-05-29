package legacydata

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
)

// ToDataSourceQueries returns queries that should be sent to a single datasource
// This will throw an error if the queries reference multiple instances
func ToDataSourceQueries(req data.QueryDataRequest) ([]backend.DataQuery, *data.DataSourceRef, error) {
	var dsRef *data.DataSourceRef
	var tr *backend.TimeRange
	if req.From != "" {
		val := NewDataTimeRange(req.From, req.To)
		tr = &backend.TimeRange{
			From: val.GetFromAsTimeUTC(),
			To:   val.GetToAsTimeUTC(),
		}
	}

	queries := []backend.DataQuery{}
	if len(req.Queries) > 0 {
		dsRef := req.Queries[0].Datasource
		for _, generic := range req.Queries {
			if generic.Datasource != nil && dsRef != nil {
				if dsRef.Type != generic.Datasource.Type {
					return queries, dsRef, fmt.Errorf("expect same datasource types")
				}
				if dsRef.UID != generic.Datasource.UID {
					return queries, dsRef, fmt.Errorf("expect same datasource UID")
				}
			}
			q, err := toBackendDataQuery(generic, tr)
			if err != nil {
				return queries, dsRef, err
			}
			queries = append(queries, q)
		}
		return queries, dsRef, nil
	}
	return queries, dsRef, nil
}

// Converts a generic query to a backend one
func toBackendDataQuery(q data.DataQuery, defaultTimeRange *backend.TimeRange) (backend.DataQuery, error) {
	var err error
	bq := backend.DataQuery{
		RefID:         q.RefID,
		QueryType:     q.QueryType,
		MaxDataPoints: q.MaxDataPoints,
	}

	// Set an explicit time range for the query
	if q.TimeRange != nil {
		tr := NewDataTimeRange(q.TimeRange.From, q.TimeRange.To)
		bq.TimeRange = backend.TimeRange{
			From: tr.GetFromAsTimeUTC(),
			To:   tr.GetToAsTimeUTC(),
		}
	} else if defaultTimeRange != nil {
		bq.TimeRange = *defaultTimeRange
	}

	bq.JSON, err = json.Marshal(q)
	if err != nil {
		return bq, err
	}
	if bq.RefID == "" {
		bq.RefID = "A"
	}
	if bq.MaxDataPoints == 0 {
		bq.MaxDataPoints = 100
	}
	if q.IntervalMS > 0 {
		bq.Interval = time.Millisecond * time.Duration(q.IntervalMS)
	} else {
		bq.Interval = time.Second
	}
	return bq, nil
}
