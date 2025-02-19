package converter

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	sdkjsoniter "github.com/grafana/grafana-plugin-sdk-go/data/utils/jsoniter"
	"github.com/influxdata/influxql"
	jsoniter "github.com/json-iterator/go"

	"github.com/grafana/grafana/pkg/tsdb/influxdb/influxql/util"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

func rspErr(e error) *backend.DataResponse {
	return &backend.DataResponse{Error: e}
}

func ReadInfluxQLStyleResult(jIter *jsoniter.Iterator, query *models.Query) *backend.DataResponse {
	iter := sdkjsoniter.NewIterator(jIter)
	var rsp *backend.DataResponse

l1Fields:
	for l1Field, err := iter.ReadObject(); ; l1Field, err = iter.ReadObject() {
		if err != nil {
			return rspErr(err)
		}
		switch l1Field {
		case "results":
			rsp = readResults(iter, query)
			if rsp.Error != nil {
				return rsp
			}
		case "error":
			v, err := iter.ReadString()
			if err != nil {
				rsp.Error = err
			} else {
				rsp.Error = errors.New(v)
			}
			return rsp
		case "code":
			// we only care of the message
			_, err := iter.Read()
			if err != nil {
				return rspErr(err)
			}
		case "message":
			v, err := iter.Read()
			if err != nil {
				return rspErr(err)
			}
			return rspErr(fmt.Errorf("%s", v))
		case "":
			break l1Fields
		default:
			v, err := iter.Read()
			// TODO: log this properly
			fmt.Printf("[ROOT] unsupported key: %s / %v\n\n", l1Field, v)
			if err != nil {
				if rsp != nil {
					rsp.Error = err
					return rsp
				} else {
					return rspErr(err)
				}
			}
		}
	}

	return rsp
}

func readResults(iter *sdkjsoniter.Iterator, query *models.Query) *backend.DataResponse {
	rsp := &backend.DataResponse{Frames: make(data.Frames, 0)}
l1Fields:
	for more, err := iter.ReadArray(); more; more, err = iter.ReadArray() {
		if err != nil {
			return rspErr(err)
		}
		for l1Field, err := iter.ReadObject(); l1Field != ""; l1Field, err = iter.ReadObject() {
			if err != nil {
				return rspErr(err)
			}
			switch l1Field {
			case "series":
				rsp = readSeries(iter, query)
			case "":
				break l1Fields
			default:
				_, err := iter.Read()
				if err != nil {
					return rspErr(err)
				}
			}
		}
	}

	return rsp
}

func readSeries(iter *sdkjsoniter.Iterator, query *models.Query) *backend.DataResponse {
	var (
		measurement   string
		tags          map[string]string
		columns       []string
		valueFields   data.Fields
		hasTimeColumn bool
	)

	// frameName is pre-allocated. So we can reuse it, saving memory.
	// It's sized for a reasonably-large name, but will grow if needed.
	frameName := make([]byte, 0, 128)

	rsp := &backend.DataResponse{Frames: make(data.Frames, 0)}
	for more, err := iter.ReadArray(); more; more, err = iter.ReadArray() {
		if err != nil {
			return rspErr(err)
		}

		for l1Field, err := iter.ReadObject(); l1Field != ""; l1Field, err = iter.ReadObject() {
			if err != nil {
				return rspErr(err)
			}
			switch l1Field {
			case "name":
				if measurement, err = iter.ReadString(); err != nil {
					return rspErr(err)
				}
			case "tags":
				if tags, err = readTags(iter); err != nil {
					return rspErr(err)
				}
			case "columns":
				columns, err = readColumns(iter)
				if err != nil {
					return rspErr(err)
				}
				if columns[0] == "time" {
					hasTimeColumn = true
				}
			case "values":
				valueFields, err = readValues(iter, hasTimeColumn)
				if err != nil {
					return rspErr(err)
				}
				if util.GetVisType(query.ResultFormat) != util.TableVisType {
					for i, v := range valueFields {
						if v.Type() == data.FieldTypeNullableJSON {
							maybeFixValueFieldType(valueFields, data.FieldTypeNullableFloat64, i)
						}
					}
				}
			default:
				v, err := iter.Read()
				if err != nil {
					return rspErr(err)
				}
				fmt.Printf("[Series] unsupported key: %s / %v\n", l1Field, v)
			}
		}

		if util.GetVisType(query.ResultFormat) == util.TableVisType {
			handleTableFormatFirstFrame(rsp, measurement, query)
			handleTableFormatFirstField(rsp, valueFields, columns)
			handleTableFormatTagFields(rsp, valueFields, tags)
			handleTableFormatValueFields(rsp, valueFields, tags, columns)
		} else {
			// time_series response format
			if hasTimeColumn {
				// Frame with time column
				newFrames := handleTimeSeriesFormatWithTimeColumn(valueFields, tags, columns, measurement, frameName, query)
				rsp.Frames = append(rsp.Frames, newFrames...)
			} else {
				// Frame without time column
				newFrame := handleTimeSeriesFormatWithoutTimeColumn(valueFields, columns, measurement, query)
				rsp.Frames = append(rsp.Frames, newFrame)
			}
		}
	}

	// if all values are null in a field, we convert the field type to NullableFloat64
	// it is because of the consistency between buffer and stream parser
	// also frontend probably will not interpret the nullableJson value
	for i, f := range rsp.Frames {
		for j, v := range f.Fields {
			if v.Type() == data.FieldTypeNullableJSON {
				newField := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, 0)
				newField.Name = v.Name
				newField.Config = v.Config
				for k := 0; k < v.Len(); k++ {
					newField.Append(nil)
				}
				rsp.Frames[i].Fields[j] = newField
			}
		}
	}

	return rsp
}

func readTags(iter *sdkjsoniter.Iterator) (map[string]string, error) {
	tags := make(map[string]string)
	for l1Field, err := iter.ReadObject(); l1Field != ""; l1Field, err = iter.ReadObject() {
		if err != nil {
			return nil, err
		}
		value, err := iter.ReadString()
		if err != nil {
			return nil, err
		}
		tags[l1Field] = value
	}
	return tags, nil
}

func readColumns(iter *sdkjsoniter.Iterator) (columns []string, err error) {
	for more, err := iter.ReadArray(); more; more, err = iter.ReadArray() {
		if err != nil {
			return nil, err
		}

		l1Field, err := iter.ReadString()
		if err != nil {
			return nil, err
		}
		columns = append(columns, l1Field)
	}
	return columns, nil
}

func readValues(iter *sdkjsoniter.Iterator, hasTimeColumn bool) (valueFields data.Fields, err error) {
	if hasTimeColumn {
		valueFields = append(valueFields, data.NewField("Time", nil, make([]time.Time, 0)))
	}

	for more, err := iter.ReadArray(); more; more, err = iter.ReadArray() {
		if err != nil {
			return nil, err
		}

		colIdx := 0

		for more2, err := iter.ReadArray(); more2; more2, err = iter.ReadArray() {
			if err != nil {
				return nil, err
			}

			if hasTimeColumn && colIdx == 0 {
				// Read time
				var t float64
				if t, err = iter.ReadFloat64(); err != nil {
					return nil, err
				}
				valueFields[0].Append(time.UnixMilli(int64(t)).UTC())

				colIdx++
				continue
			}

			// Read column values
			next, err := iter.WhatIsNext()
			if err != nil {
				return nil, err
			}

			switch next {
			case jsoniter.StringValue:
				s, err := iter.ReadString()
				if err != nil {
					return nil, err
				}
				valueFields = maybeCreateValueField(valueFields, data.FieldTypeNullableString, colIdx)
				maybeFixValueFieldType(valueFields, data.FieldTypeNullableString, colIdx)
				tryToAppendValue(valueFields, &s, colIdx)
			case jsoniter.NumberValue:
				n, err := iter.ReadFloat64()
				if err != nil {
					return nil, err
				}
				valueFields = maybeCreateValueField(valueFields, data.FieldTypeNullableFloat64, colIdx)
				maybeFixValueFieldType(valueFields, data.FieldTypeNullableFloat64, colIdx)
				tryToAppendValue(valueFields, &n, colIdx)
			case jsoniter.BoolValue:
				b, err := iter.ReadAny()
				if err != nil {
					return nil, err
				}
				valueFields = maybeCreateValueField(valueFields, data.FieldTypeNullableBool, colIdx)
				maybeFixValueFieldType(valueFields, data.FieldTypeNullableBool, colIdx)
				tryToAppendValue(valueFields, util.ToPtr(b.ToBool()), colIdx)
			case jsoniter.NilValue:
				_, _ = iter.Read()
				if len(valueFields) <= colIdx {
					// no value field created before
					// we don't know the type of the values for this field, yet
					// so we create a FieldTypeNullableJSON to hold nil values
					// if that is something else it will be replaced later
					unknownField := data.NewFieldFromFieldType(data.FieldTypeNullableJSON, 0)
					unknownField.Name = "Value"
					valueFields = append(valueFields, unknownField)
				}
				valueFields[colIdx].Append(nil)
			default:
				return nil, fmt.Errorf("unknown value type")
			}

			colIdx++
		}
	}

	return valueFields, nil
}

// maybeCreateValueField checks whether a value field has created already.
// if it hasn't, creates a new one
func maybeCreateValueField(valueFields data.Fields, expectedType data.FieldType, colIdx int) data.Fields {
	if len(valueFields) == colIdx {
		newField := data.NewFieldFromFieldType(expectedType, 0)
		newField.Name = "Value"
		valueFields = append(valueFields, newField)
	}

	return valueFields
}

// maybeFixValueFieldType checks if the value field type is matching
// For nil values we might have added FieldTypeNullableJSON value field
// if the type of the field in valueFields is not matching the expected type
// or the type of the field in valueFields is nullableJSON
// we change the type of the field as expectedType
func maybeFixValueFieldType(valueFields data.Fields, expectedType data.FieldType, colIdx int) {
	if valueFields[colIdx].Type() == expectedType || valueFields[colIdx].Type() != data.FieldTypeNullableJSON {
		return
	}
	stringField := data.NewFieldFromFieldType(expectedType, 0)
	stringField.Name = "Value"
	for i := 0; i < valueFields[colIdx].Len(); i++ {
		stringField.Append(nil)
	}
	valueFields[colIdx] = stringField
}

func tryToAppendValue[T *string | *float64 | *bool](valueFields data.Fields, value T, colIdx int) {
	if valueFields[colIdx].Type() == typeOf(value) {
		valueFields[colIdx].Append(value)
	} else {
		valueFields[colIdx].Append(nil)
	}
}

func typeOf(value interface{}) data.FieldType {
	switch v := value.(type) {
	case *string:
		return data.FieldTypeNullableString
	case *float64:
		return data.FieldTypeNullableFloat64
	case *bool:
		return data.FieldTypeNullableBool
	default:
		fmt.Printf("unknown value type: %v", v)
		return data.FieldTypeNullableJSON
	}
}

func handleTimeSeriesFormatWithTimeColumn(valueFields data.Fields, tags map[string]string, columns []string, measurement string, frameName []byte, query *models.Query) []*data.Frame {
	frames := make([]*data.Frame, 0, len(columns)-1)
	// don't iterate over first column as it is a time column already
	for i := 1; i < len(columns); i++ {
		formattedFrameName := string(util.FormatFrameName(measurement, columns[i], tags, *query, frameName[:]))
		valueFields[i].Labels = tags
		valueFields[i].Config = &data.FieldConfig{DisplayNameFromDS: formattedFrameName}

		frame := data.NewFrame(formattedFrameName, valueFields[0], valueFields[i])
		frames = append(frames, frame)
	}
	return frames
}

func handleTimeSeriesFormatWithoutTimeColumn(valueFields data.Fields, columns []string, measurement string, query *models.Query) *data.Frame {
	switch query.Statement.(type) {
	case *influxql.ShowMeasurementCardinalityStatement,
		*influxql.ShowSeriesCardinalityStatement,
		*influxql.ShowFieldKeyCardinalityStatement,
		*influxql.ShowTagValuesCardinalityStatement,
		*influxql.ShowTagKeyCardinalityStatement:
		// Handle all CARDINALITY queries
		var stringArray []*string
		for _, v := range valueFields {
			if f, ok := v.At(0).(*float64); ok {
				str := strconv.FormatFloat(*f, 'f', -1, 64)
				stringArray = append(stringArray, util.ParseString(str))
			} else {
				stringArray = append(stringArray, util.ParseString(v.At(0)))
			}
		}
		return data.NewFrame(measurement, data.NewField("Value", nil, stringArray))

	case *influxql.ShowTagValuesStatement:
		// Handle SHOW TAG VALUES (non-CARDINALITY)
		return data.NewFrame(measurement, valueFields[1])

	default:
		// Handle generic queries with at least one column
		return data.NewFrame(measurement, valueFields[0])
	}
}

func handleTableFormatFirstFrame(rsp *backend.DataResponse, measurement string, query *models.Query) {
	// Add the first and only frame for table format
	if len(rsp.Frames) == 0 {
		newFrame := data.NewFrame(measurement)
		newFrame.Meta = &data.FrameMeta{
			ExecutedQueryString:    query.RawQuery,
			PreferredVisualization: util.GetVisType(query.ResultFormat),
		}
		rsp.Frames = append(rsp.Frames, newFrame)
	}
}

func handleTableFormatFirstField(rsp *backend.DataResponse, valueFields data.Fields, columns []string) {
	if len(rsp.Frames[0].Fields) == 0 {
		rsp.Frames[0].Fields = append(rsp.Frames[0].Fields, valueFields[0])
		if columns[0] != "time" {
			rsp.Frames[0].Fields[0].Name = columns[0]
			rsp.Frames[0].Fields[0].Config = &data.FieldConfig{DisplayNameFromDS: columns[0]}
		}
	} else {
		var i int
		for i < valueFields[0].Len() {
			rsp.Frames[0].Fields[0].Append(valueFields[0].At(i))
			i++
		}
	}
}

func handleTableFormatTagFields(rsp *backend.DataResponse, valueFields data.Fields, tags map[string]string) {
	ti := 1
	// We have the first field, so we should add tagField if there is any tag
	for k, v := range tags {
		if len(rsp.Frames[0].Fields) == ti {
			tagField := data.NewField(k, nil, []*string{})
			tagField.Config = &data.FieldConfig{DisplayNameFromDS: k}
			rsp.Frames[0].Fields = append(rsp.Frames[0].Fields, tagField)
		}
		var i int
		for i < valueFields[0].Len() {
			val := v[0:]
			rsp.Frames[0].Fields[ti].Append(&val)
			i++
		}
		ti++
	}
}

func handleTableFormatValueFields(rsp *backend.DataResponse, valueFields data.Fields, tags map[string]string, columns []string) {
	// number of fields we currently have in the first frame
	// we handled first value field and then tags.
	si := len(tags) + 1
	l := len(valueFields)
	// first value field is always handled first, before tags.
	// no need to create another one again here
	for i := 1; i < l; i++ {
		if len(rsp.Frames[0].Fields) == si {
			rsp.Frames[0].Fields = append(rsp.Frames[0].Fields, valueFields[i])
		} else {
			ll := valueFields[i].Len()
			for vi := 0; vi < ll; vi++ {
				if valueFields[i].Type() == data.FieldTypeNullableJSON {
					// add nil explicitly.
					// we don't know if it is a float pointer nil or string pointer nil or etc
					rsp.Frames[0].Fields[si].Append(nil)
				} else {
					if valueFields[i].Type() != rsp.Frames[0].Fields[si].Type() {
						maybeFixValueFieldType(rsp.Frames[0].Fields, valueFields[i].Type(), si)
					}
					rsp.Frames[0].Fields[si].Append(valueFields[i].At(vi))
				}
			}
		}

		rsp.Frames[0].Fields[si].Name = columns[i]
		rsp.Frames[0].Fields[si].Config = &data.FieldConfig{DisplayNameFromDS: columns[i]}
		si++
	}
}
