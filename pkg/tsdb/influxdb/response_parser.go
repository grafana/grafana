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
		rp.parseResult(result.Series, queryRes)
	}

	return queryRes
}

func (rp *ResponseParser) parseResult(result []Row, queryResult *tsdb.QueryResult) {
	for _, r := range result {
		for columnIndex, column := range r.Columns {
			if column == "time" {
				continue
			}

			var points tsdb.TimeSeriesPoints
			for _, k := range r.Values {
				points = append(points, rp.parseTimepoint(k, columnIndex))
			}

			queryResult.Series = append(queryResult.Series, &tsdb.TimeSeries{
				Name:   rp.formatName(r, column),
				Points: points,
			})
		}
	}
}

func (rp *ResponseParser) formatName(row Row, column string) string {
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

func (rp *ResponseParser) parseTimepoint(k []interface{}, valuePosition int) tsdb.TimePoint {
	var value null.Float = rp.parseValue(k[valuePosition])

	timestampNumber, _ := k[0].(json.Number)
	timestamp, err := timestampNumber.Float64()
	if err != nil {
		glog.Error("Invalid timestamp format. This should never happen!")
	}

	return tsdb.NewTimePoint(value, timestamp)
}

func (rp *ResponseParser) parseValue(value interface{}) null.Float {
	num, ok := value.(json.Number)
	if !ok {
		return null.FloatFromPtr(nil)
	}

	fvalue, err := num.Float64()
	if err == nil {
		return null.FloatFrom(fvalue)
	}

	ivalue, err := num.Int64()
	if err == nil {
		return null.FloatFrom(float64(ivalue))
	}

	return null.FloatFromPtr(nil)
}
