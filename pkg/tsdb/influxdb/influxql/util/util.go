package util

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

var (
	legendFormat = regexp.MustCompile(`\[\[([\@\/\w-]+)(\.[\@\/\w-]+)*\]\]*|\$([\@\w-]+?)*`)
)

const (
	GraphVisType data.VisType = "graph"
	TableVisType data.VisType = "table"
	LogsVisType  data.VisType = "logs"
)

func FormatFrameName(row models.Row, column string, query models.Query, frameName []byte) []byte {
	if query.Alias == "" {
		return BuildFrameNameFromQuery(row, column, frameName, query.ResultFormat)
	}
	nameSegment := strings.Split(row.Name, ".")

	result := legendFormat.ReplaceAllFunc([]byte(query.Alias), func(in []byte) []byte {
		aliasFormat := string(in)
		aliasFormat = strings.Replace(aliasFormat, "[[", "", 1)
		aliasFormat = strings.Replace(aliasFormat, "]]", "", 1)
		aliasFormat = strings.Replace(aliasFormat, "$", "", 1)

		if aliasFormat == "m" || aliasFormat == "measurement" {
			return []byte(row.Name)
		}
		if aliasFormat == "col" {
			return []byte(column)
		}

		pos, err := strconv.Atoi(aliasFormat)
		if err == nil && len(nameSegment) > pos {
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

	return result
}

func BuildFrameNameFromQuery(row models.Row, column string, frameName []byte, resultFormat string) []byte {
	if resultFormat != "table" {
		frameName = append(frameName, row.Name...)
		frameName = append(frameName, '.')
	}
	frameName = append(frameName, column...)

	if len(row.Tags) > 0 {
		frameName = append(frameName, ' ', '{', ' ')
		first := true
		for k, v := range row.Tags {
			if !first {
				frameName = append(frameName, ',')
				frameName = append(frameName, ' ')
			} else {
				first = false
			}
			frameName = append(frameName, k...)
			frameName = append(frameName, ':', ' ')
			frameName = append(frameName, v...)
		}

		frameName = append(frameName, ' ', '}')
	}

	return frameName
}

func ParseTimestamp(value any) (time.Time, error) {
	timestampNumber, ok := value.(json.Number)
	if !ok {
		return time.Time{}, fmt.Errorf("timestamp-value has invalid type: %#v", value)
	}
	timestampInMilliseconds, err := timestampNumber.Int64()
	if err != nil {
		return time.Time{}, err
	}

	// currently in the code the influxdb-timestamps are requested with
	// milliseconds-precision, meaning these values are milliseconds
	t := time.UnixMilli(timestampInMilliseconds).UTC()

	return t, nil
}

func Typeof(values [][]any, colIndex int) string {
	for _, value := range values {
		if value != nil && value[colIndex] != nil {
			return fmt.Sprintf("%T", value[colIndex])
		}
	}
	return "null"
}

func ParseNumber(value any) *float64 {
	// NOTE: we use pointers-to-float64 because we need
	// to represent null-json-values. they come for example
	// when we do a group-by with fill(null)

	if value == nil {
		// this is what json-nulls become
		return nil
	}

	number, ok := value.(json.Number)
	if !ok {
		// in the current implementation, errors become nils
		return nil
	}

	fvalue, err := number.Float64()
	if err != nil {
		// in the current implementation, errors become nils
		return nil
	}

	return &fvalue
}

func GetVisType(resFormat string) data.VisType {
	switch resFormat {
	case "table":
		return TableVisType
	case "logs":
		return LogsVisType
	default:
		return GraphVisType
	}
}
