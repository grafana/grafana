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

func FormatFrameName(rowName, column string, tags map[string]string, query models.Query, frameName []byte) []byte {
	if query.Alias == "" {
		return BuildFrameNameFromQuery(rowName, column, tags, frameName, query.ResultFormat)
	}
	nameSegment := strings.Split(rowName, ".")

	result := legendFormat.ReplaceAllFunc([]byte(query.Alias), func(in []byte) []byte {
		aliasFormat := string(in)
		aliasFormat = strings.Replace(aliasFormat, "[[", "", 1)
		aliasFormat = strings.Replace(aliasFormat, "]]", "", 1)
		aliasFormat = strings.Replace(aliasFormat, "$", "", 1)

		if aliasFormat == "m" || aliasFormat == "measurement" {
			return []byte(rowName)
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
		tagValue, exist := tags[tagKey]
		if exist {
			return []byte(tagValue)
		}

		return in
	})

	return result
}

func BuildFrameNameFromQuery(rowName, column string, tags map[string]string, frameName []byte, resultFormat string) []byte {
	if resultFormat != "table" {
		frameName = append(frameName, rowName...)
		frameName = append(frameName, '.')
	}
	frameName = append(frameName, column...)

	if len(tags) == 0 {
		return frameName
	}
	frameName = append(frameName, ' ', '{', ' ')
	first := true
	for k, v := range tags {
		if !first {
			frameName = append(frameName, ',', ' ')
		} else {
			first = false
		}
		frameName = append(frameName, k...)
		frameName = append(frameName, ':', ' ')
		frameName = append(frameName, v...)
	}
	return append(frameName, ' ', '}')
}

func ParseTimestamp(value any) (time.Time, error) {
	timestampNumber, ok := value.(float64)
	if !ok {
		return time.Time{}, fmt.Errorf("timestamp-value has invalid type: %#v", value)
	}

	// currently in the code the influxdb-timestamps are requested with
	// milliseconds-precision, meaning these values are milliseconds
	t := time.UnixMilli(int64(timestampNumber)).UTC()

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

func ParseString(value any) *string {
	switch val := value.(type) {
	case string:
		return ToPtr(val)
	default:
		return ToPtr(fmt.Sprintf("%v", value))
	}
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

func ToPtr[T any](v T) *T {
	return &v
}
