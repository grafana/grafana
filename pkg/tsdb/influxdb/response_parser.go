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
	legendFormat = regexp.MustCompile(`\[\[([\@\/\w-]+)(\.[\@\/\w-]+)*\]\]*|\$([\@\w-]+?)*`)
)

func (rp *ResponseParser) Parse(buf io.ReadCloser, statusCode int, queries []Query) *backend.QueryDataResponse {
	return rp.parse(buf, statusCode, queries)
}

// parse is the same as Parse, but without the io.ReadCloser (we don't need to
// close the buffer)
func (*ResponseParser) parse(buf io.Reader, statusCode int, queries []Query) *backend.QueryDataResponse {
	resp := backend.NewQueryDataResponse()
	response, jsonErr := parseJSON(buf)

	if statusCode/100 != 2 {
		resp.Responses["A"] = backend.DataResponse{Error: fmt.Errorf("InfluxDB returned error: %s", response.Error)}
	}

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

func parseJSON(buf io.Reader) (Response, error) {
	var response Response

	dec := json.NewDecoder(buf)
	dec.UseNumber()

	err := dec.Decode(&response)

	return response, err
}

func transformRows(rows []Row, query Query) data.Frames {
	// pre-allocate frames - this can save many allocations
	cols := 0
	for _, row := range rows {
		cols += len(row.Columns)
	}
	frames := make([]*data.Frame, 0, len(rows)+cols)

	// frameName is pre-allocated. So we can reuse it, saving memory.
	// It's sized for a reasonably-large name, but will grow if needed.
	frameName := make([]byte, 0, 128)

	retentionPolicyQuery := isRetentionPolicyQuery(query)
	tagValuesQuery := isTagValuesQuery(query)

	for _, row := range rows {
		var hasTimeCol = false

		for _, column := range row.Columns {
			if strings.ToLower(column) == "time" {
				hasTimeCol = true
			}
		}

		if !hasTimeCol {
			newFrame := newFrameWithoutTimeField(row, retentionPolicyQuery, tagValuesQuery)
			frames = append(frames, newFrame)
		} else {
			for colIndex, column := range row.Columns {
				if column == "time" {
					continue
				}
				newFrame := newFrameWithTimeField(row, column, colIndex, query, frameName)
				frames = append(frames, newFrame)
			}
		}
	}

	return frames
}

func newFrameWithTimeField(row Row, column string, colIndex int, query Query, frameName []byte) *data.Frame {
	var timeArray []time.Time
	var floatArray []*float64
	var stringArray []*string
	var boolArray []*bool
	valType := typeof(row.Values, colIndex)

	for _, valuePair := range row.Values {
		timestamp, timestampErr := parseTimestamp(valuePair[0])
		// we only add this row if the timestamp is valid
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

	timeField := data.NewField("Time", nil, timeArray)

	var valueField *data.Field

	switch valType {
	case "string":
		valueField = data.NewField("Value", row.Tags, stringArray)
	case "json.Number":
		valueField = data.NewField("Value", row.Tags, floatArray)
	case "bool":
		valueField = data.NewField("Value", row.Tags, boolArray)
	case "null":
		valueField = data.NewField("Value", row.Tags, floatArray)
	}

	name := string(formatFrameName(row, column, query, frameName[:]))
	valueField.SetConfig(&data.FieldConfig{DisplayNameFromDS: name})
	return newDataFrame(name, query.RawQuery, timeField, valueField)
}

func newFrameWithoutTimeField(row Row, retentionPolicyQuery bool, tagValuesQuery bool) *data.Frame {
	var values []string

	if retentionPolicyQuery {
		values = make([]string, 1, len(row.Values))
	} else {
		values = make([]string, 0, len(row.Values))
	}

	for _, valuePair := range row.Values {
		if tagValuesQuery {
			if len(valuePair) >= 2 {
				values = append(values, valuePair[1].(string))
			}
		} else if retentionPolicyQuery {
			// We want to know whether the given retention policy is the default one or not.
			// If it is default policy then we should add it to the beginning.
			// The index 4 gives us if that policy is default or not.
			// https://docs.influxdata.com/influxdb/v1.8/query_language/explore-schema/#show-retention-policies
			// Only difference is v0.9. In that version we don't receive shardGroupDuration value.
			// https://archive.docs.influxdata.com/influxdb/v0.9/query_language/schema_exploration/#show-retention-policies
			// Since it is always the last value we will check that last value always.
			if len(valuePair) >= 1 {
				if valuePair[len(row.Columns)-1].(bool) {
					values[0] = valuePair[0].(string)
				} else {
					values = append(values, valuePair[0].(string))
				}
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

func newDataFrame(name string, queryString string, timeField *data.Field, valueField *data.Field) *data.Frame {
	frame := data.NewFrame(name, timeField, valueField)
	frame.Meta = &data.FrameMeta{
		ExecutedQueryString: queryString,
	}

	return frame
}

func formatFrameName(row Row, column string, query Query, frameName []byte) []byte {
	if query.Alias == "" {
		return buildFrameNameFromQuery(row, column, frameName)
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

	return result
}

func buildFrameNameFromQuery(row Row, column string, frameName []byte) []byte {
	frameName = append(frameName, row.Name...)
	frameName = append(frameName, '.')
	frameName = append(frameName, column...)

	if len(row.Tags) > 0 {
		frameName = append(frameName, ' ', '{', ' ')
		first := true
		for k, v := range row.Tags {
			if !first {
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

func parseTimestamp(value interface{}) (time.Time, error) {
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

func typeof(values [][]interface{}, colIndex int) string {
	for _, value := range values {
		if value != nil && value[colIndex] != nil {
			return fmt.Sprintf("%T", value[colIndex])
		}
	}
	return "null"
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

func isTagValuesQuery(query Query) bool {
	return strings.Contains(strings.ToLower(query.RawQuery), strings.ToLower("SHOW TAG VALUES"))
}

func isRetentionPolicyQuery(query Query) bool {
	return strings.Contains(strings.ToLower(query.RawQuery), strings.ToLower("SHOW RETENTION POLICIES"))
}
