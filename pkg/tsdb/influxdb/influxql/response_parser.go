package influxql

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/tsdb/influxdb/influxql/util"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
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
	}

	if query.ResultFormat == "table" {
		return &backend.DataResponse{Frames: transformRowsForTable(result.Series, *query)}
	}

	return &backend.DataResponse{Frames: transformRowsForTimeSeries(result.Series, *query)}
}

func parseJSON(buf io.Reader) (models.Response, error) {
	var response models.Response

	dec := json.NewDecoder(buf)
	dec.UseNumber()

	err := dec.Decode(&response)

	return response, err
}

func transformRowsForTable(rows []models.Row, query models.Query) data.Frames {
	if len(rows) == 0 {
		return make([]*data.Frame, 0)
	}

	frames := make([]*data.Frame, 0, 1)

	newFrame := data.NewFrame(rows[0].Name)
	newFrame.Meta = &data.FrameMeta{
		ExecutedQueryString:    query.RawQuery,
		PreferredVisualization: util.GetVisType(query.ResultFormat),
	}

	conLen := len(rows[0].Columns)
	if rows[0].Columns[0] == "time" {
		newFrame.Fields = append(newFrame.Fields, newTimeField(rows))
	} else {
		newFrame.Fields = append(newFrame.Fields, newValueFields(rows, nil, 0, 1)...)
	}

	newFrame.Fields = append(newFrame.Fields, newTagField(rows, nil)...)
	newFrame.Fields = append(newFrame.Fields, newValueFields(rows, nil, 1, conLen)...)

	frames = append(frames, newFrame)
	return frames
}

func newTimeField(rows []models.Row) *data.Field {
	var timeArray []time.Time
	for _, row := range rows {
		for _, valuePair := range row.Values {
			timestamp, timestampErr := util.ParseTimestamp(valuePair[0])
			// we only add this row if the timestamp is valid
			if timestampErr != nil {
				continue
			}

			timeArray = append(timeArray, timestamp)
		}
	}

	timeField := data.NewField("Time", nil, timeArray)
	return timeField
}

func newTagField(rows []models.Row, labels data.Labels) []*data.Field {
	fields := make([]*data.Field, 0, len(rows[0].Tags))

	for key := range rows[0].Tags {
		tagField := data.NewField(key, labels, []*string{})
		for _, row := range rows {
			for range row.Values {
				value := row.Tags[key]
				tagField.Append(&value)
			}
		}
		tagField.SetConfig(&data.FieldConfig{DisplayNameFromDS: key})
		fields = append(fields, tagField)
	}

	return fields
}

func newValueFields(rows []models.Row, labels data.Labels, colIdxStart, colIdxEnd int) []*data.Field {
	fields := make([]*data.Field, 0)

	for colIdx := colIdxStart; colIdx < colIdxEnd; colIdx++ {
		var valueField *data.Field
		var floatArray []*float64
		var stringArray []*string
		var boolArray []*bool

		for _, row := range rows {
			valType := util.Typeof(row.Values, colIdx)

			for _, valuePair := range row.Values {
				switch valType {
				case "string":
					value, ok := valuePair[colIdx].(string)
					if ok {
						stringArray = append(stringArray, &value)
					} else {
						stringArray = append(stringArray, nil)
					}
				case "json.Number":
					value := util.ParseNumber(valuePair[colIdx])
					floatArray = append(floatArray, value)
				case "bool":
					value, ok := valuePair[colIdx].(bool)
					if ok {
						boolArray = append(boolArray, &value)
					} else {
						boolArray = append(boolArray, nil)
					}
				case "null":
					floatArray = append(floatArray, nil)
				}
			}

			switch valType {
			case "string":
				valueField = data.NewField(row.Columns[colIdx], labels, stringArray)
			case "json.Number":
				valueField = data.NewField(row.Columns[colIdx], labels, floatArray)
			case "bool":
				valueField = data.NewField(row.Columns[colIdx], labels, boolArray)
			case "null":
				valueField = data.NewField(row.Columns[colIdx], labels, floatArray)
			}

			valueField.SetConfig(&data.FieldConfig{DisplayNameFromDS: row.Columns[colIdx]})
		}
		fields = append(fields, valueField)
	}

	return fields
}

func transformRowsForTimeSeries(rows []models.Row, query models.Query) data.Frames {
	// pre-allocate frames - this can save many allocations
	cols := 0
	for _, row := range rows {
		cols += len(row.Columns)
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

		for _, column := range row.Columns {
			if strings.ToLower(column) == "time" {
				hasTimeCol = true
			}
		}

		if !hasTimeCol {
			newFrame := newFrameWithoutTimeField(row, query)
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

func newFrameWithTimeField(row models.Row, column string, colIndex int, query models.Query, frameName []byte) *data.Frame {
	var timeArray []time.Time
	var floatArray []*float64
	var stringArray []*string
	var boolArray []*bool
	valType := util.Typeof(row.Values, colIndex)

	for _, valuePair := range row.Values {
		timestamp, timestampErr := util.ParseTimestamp(valuePair[0])
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
			value := util.ParseNumber(valuePair[colIndex])
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

	name := string(util.FormatFrameName(row, column, query, frameName[:]))
	valueField.SetConfig(&data.FieldConfig{DisplayNameFromDS: name})
	return newDataFrame(name, query.RawQuery, timeField, valueField, util.GetVisType(query.ResultFormat))
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
