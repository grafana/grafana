package influxdb

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/tsdb"
	"gopkg.in/guregu/null.v3"
)

func ParseQueryResult(response *Response) *tsdb.QueryResult {
	queryRes := tsdb.NewQueryResult()

	for _, v := range response.Results {
		for _, r := range v.Series {
			serie := tsdb.TimeSeries{Name: r.Name}
			var points tsdb.TimeSeriesPoints

			for _, k := range r.Values {
				var value null.Float
				var err error
				num, ok := k[1].(json.Number)
				if !ok {
					value = null.FloatFromPtr(nil)
				} else {
					fvalue, err := num.Float64()
					if err == nil {
						value = null.FloatFrom(fvalue)
					}
				}

				pos0, ok := k[0].(json.Number)
				timestamp, err := pos0.Float64()
				if err == nil && ok {
					points = append(points, tsdb.NewTimePoint(value, timestamp))
				} else {
					//glog.Error("Failed to convert response", "err1", err, "ok", ok, "timestamp", timestamp, "value", value.Float64)
				}
				serie.Points = points
			}
			queryRes.Series = append(queryRes.Series, &serie)
		}
	}

	for _, v := range queryRes.Series {
		glog.Info("result", "name", v.Name, "points", v.Points)
	}

	return queryRes
}
