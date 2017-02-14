package elasticsearch

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/tsdb"
)

func parseQueryResult(response []byte) (*tsdb.QueryResult, error) {
	queryRes := tsdb.NewQueryResult()

	esSearchResult := &Response{}
	err := json.Unmarshal(response, esSearchResult)
	if err != nil {
		return nil, err
	}

	timeSeries := map[string]tsdb.TimeSeriesPoints{}

	for _, aggBuckets := range esSearchResult.Aggregations {
		for _, bucket := range aggBuckets.Buckets {

			rawAggregation, _ := json.Marshal(bucket.Aggregations)

			aggregations := make(map[string]interface{})
			err := json.Unmarshal(rawAggregation, &aggregations)
			if err != nil {
				return nil, err
			}

			metricKey := ""
			var valueRow [2]null.Float
			for key, value := range aggregations {
				switch value.(type) {
				case float64:
					if key == "key" {
						valueRow[1] = parseValue(value.(float64))
					}
				case map[string]interface{}:
					valueMap := value.(map[string]interface{})
					if valueMap["value"] != nil {
						metricKey = key
						valueRow[0] = parseValue(valueMap["value"].(float64))
					}
				}

			}
			if metricKey != "" {
				if _, ok := timeSeries[metricKey]; !ok {
					timeSeries[metricKey] = make(tsdb.TimeSeriesPoints, 0)
				}
				timeSeries[metricKey] = append(timeSeries[metricKey], valueRow)
			}
		}
	}

	for id, series := range timeSeries {
		ts := &tsdb.TimeSeries{
			Name:   id,
			Points: series,
		}
		queryRes.Series = append(queryRes.Series, ts)
	}

	return queryRes, nil
}

func parseValue(value float64) null.Float {
	return null.FloatFrom(float64(value))
}
