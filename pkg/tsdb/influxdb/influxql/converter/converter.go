package converter

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	jsoniter "github.com/json-iterator/go"

	"github.com/grafana/grafana/pkg/tsdb/influxdb/influxql/util"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
	"github.com/grafana/grafana/pkg/util/converter/jsonitere"
)

func rspErr(e error) backend.DataResponse {
	return backend.DataResponse{Error: e}
}

func ReadInfluxQLStyleResult(jIter *jsoniter.Iterator, query *models.Query) backend.DataResponse {
	iter := jsonitere.NewIterator(jIter)
	var rsp backend.DataResponse
	// status := "unknown"
	// influxErrString := ""
	// warnings := []data.Notice{}

	// frameName is pre-allocated. So we can reuse it, saving memory.
	// It's sized for a reasonably-large name, but will grow if needed.
	frameName := make([]byte, 0, 128)

l1Fields:
	for l1Field, err := iter.ReadObject(); ; l1Field, err = iter.ReadObject() {
		if err != nil {
			return rspErr(err)
		}
		switch l1Field {
		case "results":
			rsp = readResults(iter, frameName, query)
			if rsp.Error != nil {
				return rsp
			}
		case "":
			if err != nil {
				return rspErr(err)
			}
			break l1Fields
		default:
			v, err := iter.Read()
			if err != nil {
				rsp.Error = err
				return rsp
			}
			fmt.Println(fmt.Printf("[ROOT] TODO, support key: %s / %v\n\n", l1Field, v))
		}
	}

	return rsp
}

func readResults(iter *jsonitere.Iterator, frameName []byte, query *models.Query) backend.DataResponse {
	rsp := backend.DataResponse{}
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
				rsp = readSeries(iter, frameName, query)
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

func readSeries(iter *jsonitere.Iterator, frameName []byte, query *models.Query) backend.DataResponse {
	var measurement string
	var tags map[string]string
	var columns []string
	var valueFields data.Fields
	var hasTimeColumn bool
	rsp := backend.DataResponse{Frames: make(data.Frames, 0)}
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
			default:
				v, err := iter.Read()
				if err != nil {
					return rspErr(err)
				}
				fmt.Println(fmt.Sprintf("[data] TODO, support key: %s / %v\n", l1Field, v))
			}
		}

		if util.GetVisType(query.ResultFormat) == util.TableVisType {
			// Add the first and only frame for table format
			if len(rsp.Frames) == 0 {
				newFrame := data.NewFrame(measurement)
				newFrame.Meta = &data.FrameMeta{
					ExecutedQueryString:    query.RawQuery,
					PreferredVisualization: util.GetVisType(query.ResultFormat),
				}
				rsp.Frames = append(rsp.Frames, newFrame)
			}

			if len(rsp.Frames[0].Fields) == 0 {
				rsp.Frames[0].Fields = append(rsp.Frames[0].Fields, valueFields[0])
			} else {
				var i int
				for i < valueFields[0].Len() {
					rsp.Frames[0].Fields[0].Append(valueFields[0].At(i))
					i++
				}
			}

			ti := 1 // We have the first field, so we should add tagField if there is any tag
			for k, v := range tags {
				if len(rsp.Frames[0].Fields) == ti {
					tagField := data.NewField(k, nil, []*string{})
					tagField.Config = &data.FieldConfig{DisplayNameFromDS: k}
					rsp.Frames[0].Fields = append(rsp.Frames[0].Fields, tagField)
				}
				var i int
				for i < valueFields[0].Len() {
					rsp.Frames[0].Fields[ti].Append(&v)
					i++
				}
				ti++
			}

			si := len(tags) + 1 // number of fields we currently have in the first frame
			for i, v := range valueFields {
				if columns[i] == "time" {
					continue
				}
				v.Name = columns[i]
				v.Config = &data.FieldConfig{DisplayNameFromDS: columns[i]}
				if len(rsp.Frames[0].Fields) == si {
					rsp.Frames[0].Fields = append(rsp.Frames[0].Fields, v)
				} else {
					vi := 0
					for vi < v.Len() {
						rsp.Frames[0].Fields[si].Append(v.At(vi))
						vi++
					}
				}
				si++
			}
		} else {
			// time_series response format
			if hasTimeColumn {
				// Frame with time column
				for i, v := range columns {
					if v == "time" {
						continue
					}
					formattedFrameName := util.FormatFrameName(measurement, v, tags, *query, frameName)
					valueFields[i].Labels = tags
					valueFields[i].Config = &data.FieldConfig{DisplayNameFromDS: string(formattedFrameName)}

					frame := data.NewFrame(string(formattedFrameName), valueFields[0], valueFields[i])
					rsp.Frames = append(rsp.Frames, frame)
				}
			} else {
				// Frame without time column
				var frame *data.Frame
				if strings.Contains(strings.ToLower(query.RawQuery), strings.ToLower("SHOW TAG VALUES")) {
					if len(columns) >= 2 {
						frame = data.NewFrame(measurement, valueFields[1])
					}
				} else {
					if len(columns) >= 1 {
						frame = data.NewFrame(measurement, valueFields[0])
					}
				}

				rsp.Frames = append(rsp.Frames, frame)
			}
		}
	}

	return rsp
}

func readTags(iter *jsonitere.Iterator) (map[string]string, error) {
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

func readColumns(iter *jsonitere.Iterator) (columns []string, err error) {
	columns = make([]string, 0)
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

	return
}

func readValues(iter *jsonitere.Iterator, hasTimeColumn bool) (valueFields data.Fields, err error) {
	valueFields = make(data.Fields, 0)
	nullValuesForFields := make([][]bool, 0)
	if hasTimeColumn {
		valueFields = append(valueFields, data.NewField("Time", nil, make([]time.Time, 0)))
		nullValuesForFields = append(nullValuesForFields, nil)
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
			} else {
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
					valueFields[colIdx].Append(&s)
				case jsoniter.NumberValue:
					n, err := iter.ReadFloat64()
					if err != nil {
						return nil, err
					}
					valueFields = maybeCreateValueField(valueFields, data.FieldTypeNullableFloat64, colIdx)
					valueFields[colIdx].Append(&n)
				case jsoniter.BoolValue:
					b, err := iter.ReadAny()
					if err != nil {
						rspErr(err)
					}
					valueFields = maybeCreateValueField(valueFields, data.FieldTypeNullableBool, colIdx)
					maybeFixValueFieldType(valueFields, data.FieldTypeNullableBool, colIdx)
					bv := b.ToBool()
					valueFields[colIdx].Append(&bv)
				case jsoniter.NilValue:
					_, _ = iter.Read()
					if len(valueFields) <= colIdx {
						// no value field created before
						// we don't know the type of the values for this field, yet
						// but we assume it is a NullableFloat64
						// if that is something else it will be replaced later
						numberField := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, 0)
						numberField.Name = "Value"
						valueFields = append(valueFields, numberField)
					}

					valueFields[colIdx].Append(nil)
				}
			}

			colIdx++
		}
	}

	return
}

// maybeCreateValueField checks whether a value field created. if not creates a new one
func maybeCreateValueField(valueFields data.Fields, expectedType data.FieldType, colIdx int) data.Fields {
	if len(valueFields) == colIdx {
		newField := data.NewFieldFromFieldType(expectedType, 0)
		newField.Name = "Value"
		valueFields = append(valueFields, newField)
	}

	return valueFields
}

// maybeFixValueFieldType checks if the value field type is matching
// For nil values we might have added NullableFloat64 value field
// if they are not matching fix it
func maybeFixValueFieldType(valueFields data.Fields, expectedType data.FieldType, colIdx int) {
	if valueFields[colIdx].Type() != expectedType {
		stringField := data.NewFieldFromFieldType(expectedType, 0)
		stringField.Name = "Value"
		var i int
		for i < valueFields[colIdx].Len() {
			stringField.Append(nil)
			i++
		}
		valueFields[colIdx] = stringField
	}
}
