package query

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

type parsedQueryRequest struct {
	Requests []backend.QueryDataRequest

	// Lookup by RefID
	ByRefID map[string]*v0alpha1.GenericDataQuery

	// Optionally show the additional query properties
	Expressions []v0alpha1.GenericDataQuery
}

func ParseQueryRequest(raw v0alpha1.QueryRequest) (parsedQueryRequest, error) {
	mixed := make(map[string]backend.QueryDataRequest)
	parsed := parsedQueryRequest{
		ByRefID: make(map[string]*v0alpha1.GenericDataQuery),
	}

	var err error
	tr := legacydata.NewDataTimeRange(raw.From, raw.To)
	backendTr := backend.TimeRange{
		From: tr.GetFromAsTimeUTC(),
		To:   tr.GetToAsTimeUTC(),
	}

	for idx, q := range raw.Queries {
		if parsed.ByRefID[q.RefID] != nil {
			return parsed, fmt.Errorf("invalid query, duplicate refId: " + q.RefID)
		}
		ptr := &raw.Queries[idx]
		parsed.ByRefID[q.RefID] = ptr

		// Extract out the expressions queries earlier
		if expr.IsDataSource(q.Datasource.Type) || expr.IsDataSource(q.Datasource.UID) {
			parsed.Expressions = append(parsed.Expressions, q)
			continue
		}

		// Forward queries to the
		dq := backend.DataQuery{
			RefID:         q.RefID,
			QueryType:     q.QueryType,
			MaxDataPoints: q.MaxDataPoints,
			TimeRange:     backendTr,
		}
		dq.JSON, err = json.Marshal(q)
		if err != nil {
			return parsed, err
		}
		if dq.RefID == "" {
			dq.RefID = "A"
		}
		if dq.MaxDataPoints == 0 {
			dq.MaxDataPoints = 100
		}
		if q.IntervalMS > 0 {
			dq.Interval = time.Duration(q.IntervalMS) * time.Millisecond
		} else {
			dq.Interval = time.Duration(time.Second)
		}

		// Just the lookup key
		key := q.Datasource.Type + "/" + q.Datasource.UID
		req, ok := mixed[key]
		if !ok {
			req = backend.QueryDataRequest{
				PluginContext: backend.PluginContext{
					PluginID: q.Datasource.Type, // Partial information
					DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
						UID:  q.Datasource.Type,
						Type: q.Datasource.Type,
					},
				},
				Queries: []backend.DataQuery{dq},
			}
			mixed[key] = req
			parsed.Requests = append(parsed.Requests, req)
		} else {
			req.Queries = append(req.Queries, dq)
		}
	}

	return parsed, nil
}
