package influxql

import (
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

var (
	timeColumn      = "time"
	timeColumnName  = "Time"
	valueColumnName = "Value"

	legendFormat = regexp.MustCompile(`\[\[([\@\/\w-]+)(\.[\@\/\w-]+)*\]\]*|\$([\@\w-]+?)*`)

	timeArray   []time.Time
	floatArray  []*float64
	stringArray []*string
	boolArray   []*bool
)

const (
	graphVisType data.VisType = "graph"
	tableVisType data.VisType = "table"
	logsVisType  data.VisType = "logs"
)

func ResponseParse(buf io.ReadCloser, statusCode int, query *models.Query) *backend.DataResponse {
	return parse(buf, statusCode, query)
}

// parse is the same as Parse, but without the io.ReadCloser (we don't need to
// close the buffer)
func parse(buf io.Reader, statusCode int, query *models.Query) *backend.DataResponse {
	response, jsonErr := parseJSON(buf)

	if statusCode/100 != 2 {
		return &backend.DataResponse{Error: fmt.Errorf("InfluxDB returned error: %s", response.Error)}
	}

	if jsonErr != nil {
		return &backend.DataResponse{Error: jsonErr}
	}

	if response.Error != "" {
		return &backend.DataResponse{Error: fmt.Errorf(response.Error)}
	}

	result := response.Results[0]
	if result.Error != "" {
		return &backend.DataResponse{Error: fmt.Errorf(result.Error)}
	} else {
		return &backend.DataResponse{Frames: transformRows(result.Series, *query)}
	}
}

func parseJSON(buf io.Reader) (models.Response, error) {
	var response models.Response

	dec := json.NewDecoder(buf)
	dec.UseNumber()

	err := dec.Decode(&response)

	return response, err
}

func transformRows(rows []models.Row, query models.Query) data.Frames {
	// Create a map for faster column name lookups
	columnToLowerCase := make(map[string]string)
	for _, row := range rows {
		for _, column := range row.Columns {
			columnToLowerCase[column] = strings.ToLower(column)
		}
	}

	if len(rows) == 0 {
		return make([]*data.Frame, 0)
	}

	// Preallocate for the worst-case scenario
	frames := make([]*data.Frame, 0, len(rows)*len(rows[0].Columns))

	// frameName is pre-allocated. So we can reuse it, saving memory.
	// It's sized for a reasonably-large name, but will grow if needed.
	frameName := make([]byte, 0, 128)

	for _, row := range rows {
		var hasTimeCol = false

		if _, ok := columnToLowerCase[timeColumn]; ok {
			hasTimeCol = true
		}

		if !hasTimeCol {
			newFrame := newFrameWithoutTimeField(row, query)
			frames = append(frames, newFrame)
		} else {
			for colIndex, column := range row.Columns {
				if columnToLowerCase[column] == timeColumn {
					continue
				}
				newFrame := newFrameWithTimeField(row, column, colIndex, query, frameName)
				frames = append(frames, newFrame)
			}
		}
	}

	return frames
}

func newFrameWithTimeField(row models.Row, column string, colIndex int, query models.Query, frameName []byte) *data.Frame {
	timeArray = timeArray[:0]
	floatArray = floatArray[:0]
	stringArray = stringArray[:0]
	boolArray = boolArray[:0]

	valType := typeof(row.Values, colIndex)

	for _, valuePair := range row.Values {
		timestamp, timestampErr := parseTimestamp(valuePair[0])
		if timestampErr != nil {
			continue
		}

		timeArray = append(timeArray, timestamp)

		switch valType {
		case "string":
			value, ok := valuePair[colIndex].(string)
			if ok {
				stringArray = append(stringArray, &value)
			} else {
				stringArray = append(stringArray, nil)
			}
		case "json.Number":
			value := parseNumber(valuePair[colIndex])
			floatArray = append(floatArray, value)
		case "bool":
			value, ok := valuePair[colIndex].(bool)
			if ok {
				boolArray = append(boolArray, &value)
			} else {
				boolArray = append(boolArray, nil)
			}
		case "null":
			floatArray = append(floatArray, nil)
		}
	}

	timeField := data.NewField(timeColumnName, nil, timeArray)

	var valueField *data.Field

	switch valType {
	case "string":
		valueField = data.NewField(valueColumnName, row.Tags, stringArray)
	case "json.Number":
		valueField = data.NewField(valueColumnName, row.Tags, floatArray)
	case "bool":
		valueField = data.NewField(valueColumnName, row.Tags, boolArray)
	case "null":
		valueField = data.NewField(valueColumnName, row.Tags, floatArray)
	}

	name := string(formatFrameName(row, column, query, frameName[:]))
	valueField.SetConfig(&data.FieldConfig{DisplayNameFromDS: name})
	return newDataFrame(name, query.RawQuery, timeField, valueField, getVisType(query.ResultFormat))
}

func newFrameWithoutTimeField(row models.Row, query models.Query) *data.Frame {
	var values []string

	for _, valuePair := range row.Values {
		if strings.Contains(strings.ToLower(query.RawQuery), strings.ToLower("SHOW TAG VALUES")) {
			if len(valuePair) >= 2 {
				values = append(values, valuePair[1].(string))
			}
		} else {
			if len(valuePair) >= 1 {
				values = append(values, valuePair[0].(string))
			}
		}
	}

	field := data.NewField("Value", nil, values)
	return data.NewFrame(row.Name, field)
}

func newDataFrame(name string, queryString string, timeField *data.Field, valueField *data.Field, visType data.VisType) *data.Frame {
	frame := data.NewFrame(name, timeField, valueField)
	frame.Meta = &data.FrameMeta{
		ExecutedQueryString:    queryString,
		PreferredVisualization: visType,
	}

	return frame
}

func formatFrameName(row models.Row, column string, query models.Query, frameName []byte) []byte {
	if query.Alias == "" {
		return buildFrameNameFromQuery(row, column, frameName, query.ResultFormat)
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

func buildFrameNameFromQuery(row models.Row, column string, frameName []byte, resultFormat string) []byte {
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

func parseTimestamp(value any) (time.Time, error) {
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

func typeof(values [][]any, colIndex int) string {
	for _, value := range values {
		if value != nil && value[colIndex] != nil {
			return fmt.Sprintf("%T", value[colIndex])
		}
	}
	return "null"
}

func parseNumber(value any) *float64 {
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

func getVisType(resFormat string) data.VisType {
	switch resFormat {
	case "table":
		return tableVisType
	case "logs":
		return logsVisType
	default:
		return graphVisType
	}
}
