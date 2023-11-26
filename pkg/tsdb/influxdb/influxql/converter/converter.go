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
	var rsp backend.DataResponse
	var measurement string
	var tags map[string]string
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
				rsp = readColumns(iter, rsp, measurement, tags, frameName[:], query)
			case "values":
				rsp = readValues(iter, rsp, tags)
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

func readValues(iter *jsonitere.Iterator, rsp backend.DataResponse, tags map[string]string) backend.DataResponse {
	timeFields := make(data.Fields, 0)
	valueFields := make(data.Fields, 0)
	var timeFieldDidRead bool

	for more, err := iter.ReadArray(); more; more, err = iter.ReadArray() {
		if err != nil {
			return rspErr(err)
		}

		var tt time.Time
		timeFieldDidRead = false
		colIdx := 0

		for more2, err := iter.ReadArray(); more2; more2, err = iter.ReadArray() {
			if err != nil {
				return rspErr(err)
			}

			if !timeFieldDidRead {
				// Read time
				var t float64
				if t, err = iter.ReadFloat64(); err != nil {
					return rspErr(err)
				}
				tt = timeFromFloat(t)
				timeFieldDidRead = true
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
					if len(valueFields) == colIdx {
						stringField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
						stringField.Name = "Value"
						valueFields = append(valueFields, stringField)
					}
					valueFields[colIdx].Append(s)
				case jsoniter.NumberValue:
					n, err := iter.ReadFloat64()
					if err != nil {
						return rspErr(err)
					}
					if len(valueFields) == colIdx {
						numberField := data.NewFieldFromFieldType(data.FieldTypeFloat64, 0)
						numberField.Name = "Value"
						valueFields = append(valueFields, numberField)
					}
					valueFields[colIdx].Append(n)
				case jsoniter.NilValue:
					_, _ = iter.Read()
					if len(valueFields) == colIdx {
						numberField := data.NewFieldFromFieldType(data.FieldTypeFloat64, 0)
						numberField.Name = "Value"
						valueFields = append(valueFields, numberField)
					}
					valueFields[colIdx].Append(float64(0))
				}

				if len(timeFields) == colIdx {
					timeField := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
					timeField.Name = data.TimeSeriesTimeFieldName
					timeFields = append(timeFields, timeField)
				}
				timeFields[colIdx].Append(tt)

				colIdx++
			}
		}
	}

	for i, v := range valueFields {
		v.Labels = tags
		v.Config = &data.FieldConfig{DisplayNameFromDS: rsp.Frames[i].Name}
		rsp.Frames[i].Fields = append(rsp.Frames[i].Fields, timeFields[i], v)
	}

	return rsp
}

func timeFromFloat(fv float64) time.Time {
	return time.UnixMilli(int64(fv)).UTC()
}
