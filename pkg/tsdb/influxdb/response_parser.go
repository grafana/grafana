package influxdb

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/tsdb"
	"gopkg.in/guregu/null.v3"
)

type ResponseParser struct{}

func (rp *ResponseParser) Parse(response *Response) *tsdb.QueryResult {
	queryRes := tsdb.NewQueryResult()

	for _, result := range response.Results {
		queryRes.Series = append(queryRes.Series, rp.transformRows(result.Series, queryRes)...)
	}

	return queryRes
}

func (rp *ResponseParser) transformRows(rows []Row, queryResult *tsdb.QueryResult) tsdb.TimeSeriesSlice {
	var result tsdb.TimeSeriesSlice

	for _, row := range rows {
		for columnIndex, column := range row.Columns {
			if column == "time" {
				continue
			}

			var points tsdb.TimeSeriesPoints
			for _, valuePair := range row.Values {
				point, err := rp.parseTimepoint(valuePair, columnIndex)
				if err == nil {
					points = append(points, point)
				}
			}
			result = append(result, &tsdb.TimeSeries{
				Name:   rp.formatSerieName(row, column),
				Points: points,
			})
		}
	}

	return result
}

func (rp *ResponseParser) formatSerieName(row Row, column string) string {
	var tags []string

	for k, v := range row.Tags {
		tags = append(tags, fmt.Sprintf("%s: %s", k, v))
	}

	tagText := ""
	if len(tags) > 0 {
		tagText = fmt.Sprintf(" { %s }", strings.Join(tags, " "))
	}

	return fmt.Sprintf("%s.%s%s", row.Name, column, tagText)
}

func (rp *ResponseParser) parseTimepoint(valuePair []interface{}, valuePosition int) (tsdb.TimePoint, error) {
	var value null.Float = rp.parseValue(valuePair[valuePosition])

	timestampNumber, _ := valuePair[0].(json.Number)
	timestamp, err := timestampNumber.Float64()
	if err != nil {
		return tsdb.TimePoint{}, err
	}

	return tsdb.NewTimePoint(value, timestamp), nil
}

func (rp *ResponseParser) parseValue(value interface{}) null.Float {
	number, ok := value.(json.Number)
	if !ok {
		return null.FloatFromPtr(nil)
	}

	fvalue, err := number.Float64()
	if err == nil {
		return null.FloatFrom(fvalue)
	}

	ivalue, err := number.Int64()
	if err == nil {
		return null.FloatFrom(float64(ivalue))
	}

	return null.FloatFromPtr(nil)
}
