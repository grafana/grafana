package influxdb

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
)

type ResponseParser struct{}

var (
	legendFormat = regexp.MustCompile(`\[\[([\@\/\w-]+)(\.[\@\/\w-]+)*\]\]*|\$(\s*([\@\w-]+?))*`)
)

func (rp *ResponseParser) Parse(buf io.ReadCloser, queries []Query) *backend.QueryDataResponse {
	resp := backend.NewQueryDataResponse()

	response, jsonErr := parseJSON(buf)
	if jsonErr != nil {
		resp.Responses["A"] = backend.DataResponse{Error: jsonErr}
		return resp
	}

	if response.Error != "" {
		resp.Responses["A"] = backend.DataResponse{Error: fmt.Errorf(response.Error)}
		return resp
	}

	for i, result := range response.Results {
		if result.Error != "" {
			resp.Responses[queries[i].RefID] = backend.DataResponse{Error: fmt.Errorf(result.Error)}
		} else {
			resp.Responses[queries[i].RefID] = backend.DataResponse{Frames: transformRows(result.Series, queries[i])}
		}
	}

	return resp
}

func parseJSON(buf io.ReadCloser) (Response, error) {
	var response Response
	dec := json.NewDecoder(buf)
	dec.UseNumber()

	err := dec.Decode(&response)
	return response, err
}

func transformRows(rows []Row, query Query) data.Frames {
	frames := data.Frames{}
	for _, row := range rows {
		for colIndex, column := range row.Columns {
			if column == "time" {
				continue
			}

			valType := typeof(row.Values[0][colIndex])
			name := formatFrameName(row, column, query)

			if valType == "string" {
				fields := parseStringSeries(row, colIndex, name)
				frames = append(frames, newDataFrame(name, query.RawQuery, fields[0], fields[1]))
			} else if valType == "json.Number" {
				fields := parseFloatSeries(row, colIndex, name)
				frames = append(frames, newDataFrame(name, query.RawQuery, fields[0], fields[1]))
			} else if valType == "bool" {
				fields := parseBoolSeries(row, colIndex, name)
				frames = append(frames, newDataFrame(name, query.RawQuery, fields[0], fields[1]))
			}
		}
	}

	return frames
}

func parseStringSeries(row Row, colIndex int, name string) []*data.Field {
	timeArray := make([]time.Time, len(row.Values))
	stringArray := make([]string, len(row.Values))
	for i, valuePair := range row.Values {
		if timestamp, err := parseTimestamp(valuePair[0]); err == nil {
			timeArray[i] = timestamp
			stringArray[i] = valuePair[colIndex].(string)
		}
	}
	timeField := data.NewField("time", nil, timeArray)
	valueField := data.NewField("value", row.Tags, stringArray)
	valueField.SetConfig(&data.FieldConfig{DisplayNameFromDS: name})
	return []*data.Field{timeField, valueField}
}

func parseFloatSeries(row Row, colIndex int, name string) []*data.Field {
	timeArray := make([]time.Time, len(row.Values))
	floatArray := make([]*float64, len(row.Values))
	for i, valuePair := range row.Values {
		if timestamp, err := parseTimestamp(valuePair[0]); err == nil {
			timeArray[i] = timestamp
			floatArray[i] = parseNumber(valuePair[colIndex])
		}
	}
	timeField := data.NewField("time", nil, timeArray)
	valueField := data.NewField("value", row.Tags, floatArray)
	valueField.SetConfig(&data.FieldConfig{DisplayNameFromDS: name})
	return []*data.Field{timeField, valueField}
}

func parseBoolSeries(row Row, colIndex int, name string) []*data.Field {
	timeArray := make([]time.Time, len(row.Values))
	boolArray := make([]bool, len(row.Values))
	for i, valuePair := range row.Values {
		if timestamp, err := parseTimestamp(valuePair[0]); err == nil {
			timeArray[i] = timestamp
			boolArray[i] = valuePair[colIndex].(bool)
		}
	}
	timeField := data.NewField("time", nil, timeArray)
	valueField := data.NewField("value", row.Tags, boolArray)
	valueField.SetConfig(&data.FieldConfig{DisplayNameFromDS: name})
	return []*data.Field{timeField, valueField}
}

func newDataFrame(name string, queryString string, timeField *data.Field, valueField *data.Field) *data.Frame {
	frame := data.NewFrame(name, timeField, valueField)
	frame.Meta = &data.FrameMeta{
		ExecutedQueryString: queryString,
	}

	return frame
}

func formatFrameName(row Row, column string, query Query) string {
	if query.Alias == "" {
		return buildFrameNameFromQuery(row, column)
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

	return string(result)
}

func buildFrameNameFromQuery(row Row, column string) string {
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

func parseTimestamp(value interface{}) (time.Time, error) {
	timestampNumber, ok := value.(json.Number)
	if !ok {
		return time.Time{}, fmt.Errorf("timestamp-value has invalid type: %#v", value)
	}
	timestampFloat, err := timestampNumber.Float64()
	if err != nil {
		return time.Time{}, err
	}

	// currently in the code the influxdb-timestamps are requested with
	// seconds-precision, meaning these values are seconds
	t := time.Unix(int64(timestampFloat), 0).UTC()

	return t, nil
}

func typeof(v interface{}) string {
	return fmt.Sprintf("%T", v)
}

func parseNumber(value interface{}) *float64 {
	// NOTE: we use pointers-to-float64 because we need
	// to represent null-json-values. they come for example
	// when we do a group-by with fill(null)

	if value == nil {
		// this is what json-nulls become
		return nil
	}

	number, ok := value.(json.Number)
	if !ok {
		// in the current inmplementation, errors become nils
		return nil
	}

	fvalue, err := number.Float64()
	if err != nil {
		// in the current inmplementation, errors become nils
		return nil
	}

	return &fvalue
}
