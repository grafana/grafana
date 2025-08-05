package expr

import (
	"encoding/json"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
)

func convertBackendQueryToDataQuery(q backend.DataQuery) (data.DataQuery, error) {
	// we first restore it from the raw json data,
	// this should take care of all datasource-specific (for example, specific
	// for prometheus or loki) fields
	var dataQuery data.DataQuery
	err := json.Unmarshal(q.JSON, &dataQuery)
	if err != nil {
		return data.DataQuery{}, err
	}

	// then we override the result with values that are available as fields in backend.DataQuery
	dataQuery.RefID = q.RefID
	dataQuery.QueryType = q.QueryType
	dataQuery.MaxDataPoints = q.MaxDataPoints
	dataQuery.IntervalMS = float64(q.Interval.Nanoseconds()) / 1000000.0
	dataQuery.TimeRange = &data.TimeRange{
		From: strconv.FormatInt(q.TimeRange.From.UnixMilli(), 10),
		To:   strconv.FormatInt(q.TimeRange.To.UnixMilli(), 10),
	}

	return dataQuery, nil
}

func ConvertBackendRequestToDataRequest(req *backend.QueryDataRequest) (*data.QueryDataRequest, error) {
	k8sReq := &data.QueryDataRequest{
		// `backend.QueryDataRequest` does not have a concept of a top-level global from/to.
		// timeRanges are always inside the queries,
		// so we leave them empty here too.
	}

	for _, q := range req.Queries {
		dataQuery, err := convertBackendQueryToDataQuery(q)
		if err != nil {
			return nil, err
		}

		k8sReq.Queries = append(k8sReq.Queries, dataQuery)
	}

	return k8sReq, nil
}
