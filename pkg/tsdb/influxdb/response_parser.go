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

func (rp *ResponseParser) Parse(buf io.ReadCloser, query *Query) *backend.QueryDataResponse {
	resp := backend.NewQueryDataResponse()
	queryRes := backend.DataResponse{}

	response, jsonErr := parseJSON(buf)
	if jsonErr != nil {
		queryRes.Error = jsonErr
		resp.Responses["A"] = queryRes
		return resp
	}

	if response.Error != "" {
		queryRes.Error = fmt.Errorf(response.Error)
		resp.Responses["A"] = queryRes
		return resp
	}

	frames := data.Frames{}
	for _, result := range response.Results {
		frames = append(frames, transformRows(result.Series, query)...)
		if result.Error != "" {
			queryRes.Error = fmt.Errorf(result.Error)
		}
	}
	queryRes.Frames = frames
	resp.Responses["A"] = queryRes

	return resp
}

func parseJSON(buf io.ReadCloser) (Response, error) {
	var response Response
	dec := json.NewDecoder(buf)
	dec.UseNumber()

	err := dec.Decode(&response)
	return response, err
}

func transformRows(rows []Row, query *Query) data.Frames {
	frames := data.Frames{}
	for _, row := range rows {
		for columnIndex, column := range row.Columns {
			if column == "time" {
				continue
			}

			var timeArray []time.Time
			var valueArray []*float64

			for _, valuePair := range row.Values {
				timestamp, timestampErr := parseTimestamp(valuePair[0])
				// we only add this row if the timestamp is valid
				if timestampErr == nil {
					value := parseValue(valuePair[columnIndex])
					timeArray = append(timeArray, timestamp)
					valueArray = append(valueArray, value)
				}
			}
			name := formatFrameName(row, column, query)

			timeField := data.NewField("time", nil, timeArray)
			valueField := data.NewField("value", row.Tags, valueArray)

			// set a nice name on the value-field
			valueField.SetConfig(&data.FieldConfig{DisplayNameFromDS: name})

			frames = append(frames, data.NewFrame(name, timeField, valueField))
		}
	}

	return frames
}

func formatFrameName(row Row, column string, query *Query) string {
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

func parseValue(value interface{}) *float64 {
	// NOTE: we use pointers-to-float64 because we need
	// to represent null-json-values. they come for example
	// when we do a group-by with fill(null)

	// FIXME: the value of an influxdb-query can be:
	// - string
	// - float
	// - integer
	// - boolean
	//
	// here we only handle numeric values. this is probably
	// enough for alerting, but later if we want to support
	// arbitrary queries, we will have to improve the code

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
