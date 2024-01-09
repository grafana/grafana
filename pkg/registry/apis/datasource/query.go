package datasource

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

// Copied from: https://github.com/grafana/grafana/blob/main/pkg/api/dtos/models.go#L62
type rawMetricRequest struct {
	// From Start time in epoch timestamps in milliseconds or relative using Grafana time units.
	// required: true
	// example: now-1h
	From string `json:"from"`
	// To End time in epoch timestamps in milliseconds or relative using Grafana time units.
	// required: true
	// example: now
	To string `json:"to"`
	// queries.refId – Specifies an identifier of the query. Is optional and default to “A”.
	// queries.datasourceId – Specifies the data source to be queried. Each query in the request must have an unique datasourceId.
	// queries.maxDataPoints - Species maximum amount of data points that dashboard panel can render. Is optional and default to 100.
	// queries.intervalMs - Specifies the time interval in milliseconds of time series. Is optional and defaults to 1000.
	// required: true
	// example: [ { "refId": "A", "intervalMs": 86400000, "maxDataPoints": 1092, "datasource":{ "uid":"PD8C576611E62080A" }, "rawSql": "SELECT 1 as valueOne, 2 as valueTwo", "format": "table" } ]
	Queries []rawDataQuery `json:"queries"`
	// required: false
	Debug bool `json:"debug"`
}

type rawDataQuery = map[string]interface{}

func readQueries(in []byte) ([]backend.DataQuery, error) {
	reqDTO := &rawMetricRequest{}
	err := json.Unmarshal(in, &reqDTO)
	if err != nil {
		return nil, err
	}

	if len(reqDTO.Queries) == 0 {
		return nil, fmt.Errorf("expected queries")
	}

	tr := legacydata.NewDataTimeRange(reqDTO.From, reqDTO.To)
	backendTr := backend.TimeRange{
		From: tr.MustGetFrom(),
		To:   tr.MustGetTo(),
	}
	queries := make([]backend.DataQuery, 0)

	for _, query := range reqDTO.Queries {
		dataQuery := backend.DataQuery{
			TimeRange: backendTr,
		}

		v, ok := query["refId"]
		if ok {
			dataQuery.RefID, ok = v.(string)
			if !ok {
				return nil, fmt.Errorf("expeted string refId")
			}
		}

		v, ok = query["queryType"]
		if ok {
			dataQuery.QueryType, ok = v.(string)
			if !ok {
				return nil, fmt.Errorf("expeted string queryType")
			}
		}

		v, ok = query["maxDataPoints"]
		if ok {
			vInt, ok := v.(float64)
			if !ok {
				return nil, fmt.Errorf("expected float64 maxDataPoints")
			}

			dataQuery.MaxDataPoints = int64(vInt)
		}

		v, ok = query["intervalMs"]
		if ok {
			vInt, ok := v.(float64)
			if !ok {
				return nil, fmt.Errorf("expected float64 intervalMs")
			}

			dataQuery.Interval = time.Duration(vInt)
		}

		dataQuery.JSON, err = json.Marshal(query)
		if err != nil {
			return nil, err
		}

		queries = append(queries, dataQuery)
	}

	return queries, nil
}
