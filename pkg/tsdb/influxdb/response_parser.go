package influxdb

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/plugins/models"
)

type ResponseParser struct{}

var (
	legendFormat *regexp.Regexp
)

func init() {
	legendFormat = regexp.MustCompile(`\[\[(\w+)(\.\w+)*\]\]*|\$\s*(\w+?)*`)
}

func (rp *ResponseParser) Parse(response *Response, query *Query) models.TSDBQueryResult {
	var queryRes models.TSDBQueryResult

	for _, result := range response.Results {
		queryRes.Series = append(queryRes.Series, rp.transformRows(result.Series, queryRes, query)...)
		if result.Err != nil {
			queryRes.Error = result.Err
		}
	}

	return queryRes
}

func (rp *ResponseParser) transformRows(rows []Row, queryResult models.TSDBQueryResult, query *Query) models.TSDBTimeSeriesSlice {
	var result models.TSDBTimeSeriesSlice
	for _, row := range rows {
		for columnIndex, column := range row.Columns {
			if column == "time" {
				continue
			}

			var points models.TSDBTimeSeriesPoints
			for _, valuePair := range row.Values {
				point, err := rp.parseTimepoint(valuePair, columnIndex)
				if err == nil {
					points = append(points, point)
				}
			}
			result = append(result, models.TSDBTimeSeries{
				Name:   rp.formatSeriesName(row, column, query),
				Points: points,
				Tags:   row.Tags,
			})
		}
	}

	return result
}

func (rp *ResponseParser) formatSeriesName(row Row, column string, query *Query) string {
	if query.Alias == "" {
		return rp.buildSeriesNameFromQuery(row, column)
	}

	nameSegment := strings.Split(row.Name, ".")

	result := legendFormat.ReplaceAllFunc([]byte(query.Alias), func(in []byte) []byte {
		aliasFormat := string(in)
		aliasFormat = strings.Replace(aliasFormat, "[[", "", 1)
		aliasFormat = strings.Replace(aliasFormat, "]]", "", 1)
		aliasFormat = strings.Replace(aliasFormat, "$", "", 1)

		if aliasFormat == "m" || aliasFormat == "measurement" {
			return []byte(query.Measurement)
		}
		if aliasFormat == "col" {
			return []byte(column)
		}

		pos, err := strconv.Atoi(aliasFormat)
		if err == nil && len(nameSegment) >= pos {
			return []byte(nameSegment[pos])
		}

		if !strings.HasPrefix(aliasFormat, "tag_") {
			return in
		}

		tagKey := strings.Replace(aliasFormat, "tag_", "", 1)
		tagValue, exist := row.Tags[tagKey]
		if exist {
			return []byte(tagValue)
		}

		return in
	})

	return string(result)
}

func (rp *ResponseParser) buildSeriesNameFromQuery(row Row, column string) string {
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

func (rp *ResponseParser) parseTimepoint(valuePair []interface{}, valuePosition int) (models.TSDBTimePoint, error) {
	value := rp.parseValue(valuePair[valuePosition])

	timestampNumber, ok := valuePair[0].(json.Number)
	if !ok {
		return models.TSDBTimePoint{}, fmt.Errorf("valuePair[0] has invalid type: %#v", valuePair[0])
	}
	timestamp, err := timestampNumber.Float64()
	if err != nil {
		return models.TSDBTimePoint{}, err
	}

	return models.TSDBTimePoint{value, null.FloatFrom(timestamp)}, nil
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
