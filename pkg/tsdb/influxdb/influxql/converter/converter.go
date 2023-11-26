package converter

import (
	"fmt"
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
			case "values":
				valueFields, err = readValues(iter)
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
			// add the rsp.Frames[0]
		} else {
			timeColExist := false
			for i, v := range columns {
				if v == "time" {
					timeColExist = true
					continue
				}
				formattedFrameName := util.FormatFrameName(measurement, v, tags, *query, frameName)
				valueFields[i].Labels = tags
				valueFields[i].Config = &data.FieldConfig{DisplayNameFromDS: string(formattedFrameName)}

				var frame *data.Frame
				if timeColExist {
					frame = data.NewFrame(string(formattedFrameName), valueFields[0], valueFields[i])
				} else {
					frame = data.NewFrame(string(formattedFrameName), valueFields[i])
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

func readValues(iter *jsonitere.Iterator) (valueFields data.Fields, err error) {
	valueFields = make(data.Fields, 0)
	timeField := data.NewField("Time", nil, make([]time.Time, 0))
	valueFields = append(valueFields, timeField)
	nullValuesForFields := make([][]bool, 0)

	for more, err := iter.ReadArray(); more; more, err = iter.ReadArray() {
		if err != nil {
			return nil, err
		}

		var tt time.Time
		colIdx := 0

		for more2, err := iter.ReadArray(); more2; more2, err = iter.ReadArray() {
			if err != nil {
				return nil, err
			}

			if colIdx == 0 {
				// Read time
				var t float64
				if t, err = iter.ReadFloat64(); err != nil {
					return nil, err
				}
				tt = timeFromFloat(t)
				timeField.Append(tt)
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
					if len(valueFields) == colIdx {
						stringField := data.NewFieldFromFieldType(data.FieldTypeNullableString, 0)
						stringField.Name = "Value"
						valueFields = append(valueFields, stringField)
						appendNilsToField(valueFields, nullValuesForFields, colIdx)
					}
					valueFields[colIdx].Append(&s)
				case jsoniter.NumberValue:
					n, err := iter.ReadFloat64()
					if err != nil {
						return nil, err
					}
					if len(valueFields) == colIdx {
						numberField := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, 0)
						numberField.Name = "Value"
						valueFields = append(valueFields, numberField)
						appendNilsToField(valueFields, nullValuesForFields, colIdx)
					}
					valueFields[colIdx].Append(&n)
				case jsoniter.BoolValue:
					b, err := iter.ReadAny()
					if err != nil {
						rspErr(err)
					}
					if len(valueFields) == colIdx {
						boolField := data.NewFieldFromFieldType(data.FieldTypeNullableBool, 0)
						boolField.Name = "Value"
						valueFields = append(valueFields, boolField)
						appendNilsToField(valueFields, nullValuesForFields, colIdx)
					}
					bv := b.ToBool()
					valueFields[colIdx].Append(&bv)
				case jsoniter.NilValue:
					_, _ = iter.Read()
					if len(valueFields) <= colIdx {
						// no value field created before
						// we don't know the type of the values for this field, yet
						// we cannot create a value field
						// instead we add nil values to an array to be added
						// when we learn the type of this field
						if len(nullValuesForFields) < colIdx {
							nullValuesForFields = append(nullValuesForFields, make([]bool, 0))
						}
						nullValuesForFields[colIdx-1] = append(nullValuesForFields[colIdx-1], true)
					} else {
						valueFields[colIdx].Append(nil)
					}
				}
			}

			colIdx++
		}
	}

	return
}

func appendNilsToField(fields data.Fields, nullValuesForFields [][]bool, idx int) {
	if len(nullValuesForFields) < idx {
		return
	}
	// Append nil values if there is any.
	// we check the value at idx-1 because there is no null value for time column
	for range nullValuesForFields[idx-1] {
		fields[idx].Append(nil)
	}
	// clean the nil value array
	nullValuesForFields[idx-1] = nil
}

func timeFromFloat(fv float64) time.Time {
	return time.UnixMilli(int64(fv)).UTC()
}
