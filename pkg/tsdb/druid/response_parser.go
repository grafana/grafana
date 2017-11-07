package druid

import (
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"io/ioutil"
	"net/http"
	"time"
)

type DruidResponseParser struct{}

func (drp *DruidResponseParser) ParseResponse(res *http.Response, data *simplejson.Json) (map[string]*tsdb.QueryResult, error) {

	queryResults := make(map[string]*tsdb.QueryResult)
	queryRes := tsdb.NewQueryResult()

	body, err := ioutil.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		return nil, err
	}

	if res.StatusCode/100 != 2 {
		plog.Info("Request failed", "status", res.Status, "body", string(body))
		return nil, fmt.Errorf("Request failed status: %v", res.Status)
	}

	switch queryType := data.Get("queryType").MustString(); queryType {
	case "timeseries":

		metricNames := drp.getMetricNames(data)
		err = drp.parseTimeSeriesResponse(res, &body, queryRes, metricNames)

	case "topN":

		dimension := data.Get("dimension").MustString()
		metric := data.Get("metric").MustString()
		err = drp.parseTopNResponse(res, &body, queryRes, dimension, metric)

	case "groupBy":

		groupBy := data.Get("groupBy").MustString()
		err = drp.parseGroupByResponse(res, &body, queryRes, groupBy)

	case "select":

		err = drp.parseSelectResponse(res, &body, queryRes)

	default:
		return nil, fmt.Errorf("Unsupported query type: %v", queryType)

	}

	if err != nil {
		return nil, err
	}

	queryResults["A"] = queryRes
	return queryResults, nil
}

func (drp *DruidResponseParser) parseTimeSeriesResponse(res *http.Response,
	body *[]byte, queryRes *tsdb.QueryResult, metricNames []string) error {

	/*
	   Druid timeseries response looks like this:
	   [
	     {
	       "timestamp": "2017-09-26T23:00:00.000Z",
	       "result": {
	         "count": 1234,
	         "sum": 5678,
	       }
	     },
	     {
	       "timestamp": "2017-09-26T22:00:00.000Z",
	       "result": {
	         "count": 4321,
	         "sum": 8765
	       }
	     },
	     ...
	   ]
	*/
	var queryResponse []TimeSeriesResponse

	err := json.Unmarshal(*body, &queryResponse)

	if err != nil {
		plog.Info("Failed to unmarshal druid timeseries response", "error", err, "status", res.Status, "body", string(*body))
		return err
	}

	// Here we loop through all metrics, compose each data series with format: {value, timestamp}
	for _, name := range metricNames {
		series := tsdb.TimeSeries{
			Name: name,
		}

		for _, val := range queryResponse {

			timestamp, err := drp.convertRFC3339ToSeconds(val.Timestamp)
			if err != nil {
				plog.Info("Failed to parse druid timestamp", "timestamp", val.Timestamp)
				return err
			}

			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(val.Result[name]), timestamp))
		}
		queryRes.Series = append(queryRes.Series, &series)
	}

	return nil
}

func (drp *DruidResponseParser) parseTopNResponse(res *http.Response,
	body *[]byte, queryRes *tsdb.QueryResult, dimension string, metric string) error {
	/*
			  Druid topN results look like this:
			  [
				{
				  "timestamp": "ts1",
				  "result": [
					{"<dim>": d1, "<metric>": mv1},
					{"<dim>": d2, "<metric>": mv2}
				  ]
				},
				{
				  "timestamp": "ts2",
				  "result": [
					{"<dim>": d1, "<metric>": mv1_1}
					{"<dim>": d3, "<metric>": mv3}
				  ]
				},
	      {
				  "timestamp": "ts3",
				  "result": []
				},
				...
			  ]
	*/
	var queryResponse []TopNResponse

	err := json.Unmarshal(*body, &queryResponse)

	if err != nil {
		plog.Info("Failed to unmarshal druid topN response", "error", err, "status", res.Status, "body", string(*body))
		return err
	}

	//Get a list of all distinct dimensions for the entire result set
	allDimensions := make(map[string]bool)

	fmt.Println("Reponse is:")
	fmt.Println(queryResponse[0])

	fmt.Println("dimension is:")
	fmt.Println(dimension)
	for _, tsItem := range queryResponse {
		result := tsItem.Result
		for _, m := range result {
			allDimensions[m[dimension].(string)] = true
		}
	}

	//Add null for the metric for any missing dimension values per timestamp result
	for _, tsItem := range queryResponse {
		result := tsItem.Result
		currentAllDims := make(map[string]bool)
		for _, m := range result {
			currentAllDims[m[dimension].(string)] = true
		}

		for dim, _ := range allDimensions {
			if _, ok := currentAllDims[dim]; !ok {
				nullPoint := make(map[string]interface{})
				nullPoint[dim] = 0
				nullPoint[metric] = nil
				tsItem.Result = append(tsItem.Result, nullPoint)
			}
		}
	}

	//Re-index the results by dimension value instead of time interval
	for dim, _ := range allDimensions {
		series := tsdb.TimeSeries{
			Name: dim,
		}

		for _, tsItem := range queryResponse {
			timestamp, err := drp.convertRFC3339ToSeconds(tsItem.Timestamp)
			if err != nil {
				plog.Info("Failed to parse druid timestamp", "timestamp", tsItem.Timestamp)
				return err
			}
			for _, entry := range tsItem.Result {
				series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(entry["metric"].(float64)), timestamp))
			}
		}

		queryRes.Series = append(queryRes.Series, &series)
	}

	return nil
}

func (drp *DruidResponseParser) parseGroupByResponse(res *http.Response,
	body *[]byte, queryRes *tsdb.QueryResult, groupBy string) error {

	var queryResponse []GroupByResponse

	err := json.Unmarshal(*body, &queryResponse)

	if err != nil {
		plog.Info("Failed to unmarshal druid groupBy response", "error", err, "status", res.Status, "body", string(*body))
		return err
	}

	// Get a list of metric names for each timestamp
	var names []string
	if len(queryResponse) > 0 {
		for k, _ := range queryResponse[0].Event {
			names = append(names, k)
		}
	}

	for _, name := range names {
		series := tsdb.TimeSeries{
			Name: name,
		}

		for _, tsItem := range queryResponse {
			timestamp, err := drp.convertRFC3339ToSeconds(tsItem.Timestamp)
			if err != nil {
				plog.Info("Failed to parse druid timestamp", "timestamp", tsItem.Timestamp)
				return err
			}
			for _, v := range tsItem.Event {
				series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(v), timestamp))
			}
		}

		queryRes.Series = append(queryRes.Series, &series)
	}

	return nil
}

func (drp *DruidResponseParser) parseSelectResponse(res *http.Response,
	body *[]byte, queryRes *tsdb.QueryResult) error {

	var queryResponse []SelectResponse

	err := json.Unmarshal(*body, &queryResponse)

	if err != nil {
		plog.Info("Failed to unmarshal druid groupBy response", "error", err, "status", res.Status, "body", string(*body))
		return err
	}

	allProps := make(map[string]tsdb.TimeSeries)

	for _, tsItem := range queryResponse {
		resultList := tsItem.Result
		eventsList := resultList["events"].([]interface{})
		for _, item := range eventsList {
			event := item.(map[string]interface{})["event"].(map[string]interface{})
			if ts, ok := event["timestamp"]; ok {
				timestamp, err := drp.convertRFC3339ToSeconds(ts.(string))
				if err != nil {
					plog.Info("Failed to parse druid timestamp", "timestamp", timestamp)
					return err
				}

				for k, v := range event {
					if k != "timestamp" {
						if series, ok := allProps[k]; ok {
							series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(v.(float64)), timestamp))
						} else {
							s := tsdb.TimeSeries{
								Name: k,
							}
							s.Points = append(s.Points, tsdb.NewTimePoint(null.FloatFrom(v.(float64)), timestamp))
							allProps[k] = s
						}
					}
				}
			} else {
				continue
			}
		}
	}

	for _, series := range allProps {
		queryRes.Series = append(queryRes.Series, &series)
	}

	return nil
}

func (drp *DruidResponseParser) getMetricNames(data *simplejson.Json) []string {
	var result []string
	nameMap := make(map[string]bool)

	agg := data.Get("aggregations").MustArray()

	for _, val := range agg {

		if mp, ok := val.(map[string]interface{}); ok {

			aggType := mp["type"].(string)

			var hidden bool
			if hidden, ok = mp["hidden"].(bool); ok {
				hidden = mp["hidden"].(bool)
			}

			if aggType != "approxHistogramFold" && !hidden {
				nameMap[mp["name"].(string)] = true
			}
		}
	}

	pagg := data.Get("postAggregations").MustArray()

	for _, val := range pagg {

		if mp, ok := val.(map[string]interface{}); ok {

			nameMap[mp["name"].(string)] = true
		}
	}

	for k, _ := range nameMap {
		result = append(result, k)
	}

	return result
}

func (drp *DruidResponseParser) convertRFC3339ToSeconds(timeString string) (float64, error) {
	t, err := time.Parse(time.RFC3339, timeString)
	if err != nil {
		plog.Info("Failed to parse druid timestamp", "timestamp", timeString)
		return 0, err
	}
	return float64(t.UnixNano() / int64(time.Second)), nil
}
