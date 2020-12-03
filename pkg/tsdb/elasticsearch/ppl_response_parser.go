package elasticsearch

import (
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

type pplResponseParser struct {
	Response *es.PPLResponse
}

var newPPLResponseParser = func(response *es.PPLResponse) *pplResponseParser {
	return &pplResponseParser{
		Response: response,
	}
}

// Stores meta info on response object
type responseMeta struct {
	valueIndex      int
	timeFieldIndex  int
	timeFieldFormat string
}

func (rp *pplResponseParser) parseTimeSeries() (*tsdb.QueryResult, error) {
	queryRes := tsdb.NewQueryResult()

	var debugInfo *simplejson.Json
	if rp.Response.DebugInfo != nil {
		debugInfo = simplejson.NewFromAny(rp.Response.DebugInfo)
	}

	queryRes.Meta = debugInfo

	if rp.Response.Error != nil {
		queryRes = getErrorFromPPLResponse(rp.Response)
		queryRes.Meta = debugInfo
		return queryRes, nil
	}

	t, err := getResponseMeta(rp.Response.Schema)
	if err != nil {
		return nil, err
	}

	var points tsdb.TimeSeriesPoints

	for _, datarow := range rp.Response.Datarows {
		point, err := rp.parseTimepoint(datarow, t)
		if err != nil {
			return nil, err
		}
		points = append(points, point)
	}

	newSeries := tsdb.TimeSeries{
		Name:   rp.getSeriesName(t.valueIndex),
		Points: points,
	}

	queryRes.Series = append(queryRes.Series, &newSeries)

	return queryRes, nil
}

func (rp *pplResponseParser) parseTimepoint(datarow es.Datarow, t responseMeta) (tsdb.TimePoint, error) {
	value, err := rp.parseValue(datarow[t.valueIndex])
	if err != nil {
		return tsdb.TimePoint{}, err
	}
	timestampNumber, err := rp.parseTimestamp(datarow[t.timeFieldIndex], t.timeFieldFormat)
	if err != nil {
		return tsdb.TimePoint{}, err
	}
	return tsdb.NewTimePoint(value, timestampNumber), nil
}

func (rp *pplResponseParser) parseValue(value interface{}) (null.Float, error) {
	number, ok := value.(float64)
	if !ok {
		return null.FloatFromPtr(nil), errors.New("found non-numerical value in value field")
	}
	return null.FloatFrom(number), nil
}

func (rp *pplResponseParser) parseTimestamp(value interface{}, format string) (float64, error) {
	timestampString, ok := value.(string)
	if !ok {
		return 0, errors.New("unable to parse time field")
	}
	timestamp, err := time.Parse(format, timestampString)
	if err != nil {
		return 0, err
	}
	return float64(timestamp.UnixNano()) / float64(time.Millisecond), nil
}

func (rp *pplResponseParser) getSeriesName(valueIndex int) string {
	schema := rp.Response.Schema
	return schema[valueIndex].Name
}

func getResponseMeta(schema []es.FieldSchema) (responseMeta, error) {
	if len(schema) != 2 {
		return responseMeta{}, fmt.Errorf("response should have 2 fields but found %v", len(schema))
	}
	var timeIndex int
	var format string
	found := false
	for i, field := range schema {
		if field.Type == "timestamp" || field.Type == "datetime" || field.Type == "date" {
			timeIndex = i
			found = true
			if field.Type == "date" {
				format = pplDateFormat
			} else {
				format = pplTSFormat
			}
		}
	}
	if !found {
		return responseMeta{}, errors.New("a valid time field type was not found in response")
	}
	return responseMeta{valueIndex: 1 - timeIndex, timeFieldIndex: timeIndex, timeFieldFormat: format}, nil
}

func getErrorFromPPLResponse(response *es.PPLResponse) *tsdb.QueryResult {
	result := tsdb.NewQueryResult()
	json := simplejson.NewFromAny(response.Error)
	reason := json.Get("reason").MustString()

	if reason != "" {
		result.ErrorString = reason
	} else {
		result.ErrorString = "Unknown elasticsearch error response"
	}

	return result
}
