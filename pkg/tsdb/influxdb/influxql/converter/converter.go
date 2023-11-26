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
	rsp := backend.DataResponse{Frames: make(data.Frames, 0)}
	for more, err := iter.ReadArray(); more; more, err = iter.ReadArray() {
		if err != nil {
			return rspErr(err)
		}

		currentFrameLen := len(rsp.Frames)

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
				rsp = readColumns(iter, rsp, measurement, tags, frameName[:], query)
			case "values":
				rsp = readValues(iter, rsp, tags, currentFrameLen)
			default:
				v, err := iter.Read()
				if err != nil {
					return rspErr(err)
				}
				fmt.Println(fmt.Sprintf("[data] TODO, support key: %s / %v\n", l1Field, v))
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

func readColumns(iter *jsonitere.Iterator, rsp backend.DataResponse, rowName string, tags map[string]string, frameName []byte, query *models.Query) backend.DataResponse {
	for more, err := iter.ReadArray(); more; more, err = iter.ReadArray() {
		if err != nil {
			return rspErr(err)
		}

		l1Field, err := iter.ReadString()
		if err != nil {
			return rspErr(err)
		}
		if l1Field != "time" {
			formattedFrameName := util.FormatFrameName(rowName, l1Field, tags, *query, frameName)
			frame := data.NewFrame(string(formattedFrameName))
			rsp.Frames = append(rsp.Frames, frame)
		}
	}

	return rsp
}

func readValues(iter *jsonitere.Iterator, rsp backend.DataResponse, tags map[string]string, frameLength int) backend.DataResponse {
	timeField := data.NewField("Time", nil, make([]time.Time, 0))
	valueFields := make(data.Fields, 0)
	nullValuesForFields := make([][]bool, 0)

	for more, err := iter.ReadArray(); more; more, err = iter.ReadArray() {
		if err != nil {
			return rspErr(err)
		}

		var tt time.Time
		colIdx := 0

		for more2, err := iter.ReadArray(); more2; more2, err = iter.ReadArray() {
			if err != nil {
				return rspErr(err)
			}

			if colIdx == 0 {
				// Read time
				var t float64
				if t, err = iter.ReadFloat64(); err != nil {
					return rspErr(err)
				}
				tt = timeFromFloat(t)
				timeField.Append(tt)
			} else {
				// Read column values
				next, err := iter.WhatIsNext()
				if err != nil {
					return rspErr(err)
				}

				switch next {
				case jsoniter.StringValue:
					s, err := iter.ReadString()
					if err != nil {
						return rspErr(err)
					}
					if len(valueFields) < colIdx {
						stringField := data.NewFieldFromFieldType(data.FieldTypeNullableString, 0)
						stringField.Name = "Value"
						valueFields = append(valueFields, stringField)
						appendNilsToField(valueFields, nullValuesForFields, colIdx)
					}
					valueFields[colIdx-1].Append(&s)
				case jsoniter.NumberValue:
					n, err := iter.ReadFloat64()
					if err != nil {
						return rspErr(err)
					}
					if len(valueFields) < colIdx {
						numberField := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, 0)
						numberField.Name = "Value"
						valueFields = append(valueFields, numberField)
						appendNilsToField(valueFields, nullValuesForFields, colIdx)
					}
					valueFields[colIdx-1].Append(&n)
				case jsoniter.BoolValue:
					b, err := iter.ReadAny()
					if err != nil {
						rspErr(err)
					}
					if len(valueFields) < colIdx {
						boolField := data.NewFieldFromFieldType(data.FieldTypeNullableBool, 0)
						boolField.Name = "Value"
						valueFields = append(valueFields, boolField)
						appendNilsToField(valueFields, nullValuesForFields, colIdx)
					}
					bv := b.ToBool()
					valueFields[colIdx-1].Append(&bv)
				case jsoniter.NilValue:
					_, _ = iter.Read()
					if len(valueFields) < colIdx {
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
						valueFields[colIdx-1].Append(nil)
					}
				}
			}

			colIdx++
		}
	}

	for i, v := range valueFields {
		v.Labels = tags
		v.Config = &data.FieldConfig{DisplayNameFromDS: rsp.Frames[frameLength+i].Name}
		rsp.Frames[frameLength+i].Fields = append(rsp.Frames[frameLength+i].Fields, timeField, v)
	}

	return rsp
}

func appendNilsToField(fields data.Fields, nullValuesForFields [][]bool, idx int) {
	// Append nil values if there is any
	for range nullValuesForFields[idx-1] {
		fields[idx-1].Append(nil)
	}
	// clean the nil value array
	nullValuesForFields[idx-1] = nil
}

func timeFromFloat(fv float64) time.Time {
	return time.UnixMilli(int64(fv)).UTC()
}
