package converter

import (
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	jsoniter "github.com/json-iterator/go"
)

// ReadPrometheusStyleResult will read results from a prometheus or loki server and return data frames
func ReadPrometheusStyleResult(iter *jsoniter.Iterator) *backend.DataResponse {
	var rsp *backend.DataResponse
	status := "unknown"

	for l1Field := iter.ReadObject(); l1Field != ""; l1Field = iter.ReadObject() {
		switch l1Field {
		case "status":
			status = iter.ReadString()

		case "data":
			rsp = readPrometheusData(iter)

		// case "error":
		// case "errorType":
		// case "warnings":
		default:
			v := iter.Read()
			fmt.Printf("[ROOT] TODO, support key: %s / %v\n", l1Field, v)
		}
	}

	if status != "success" {
		fmt.Printf("ERROR: %s\n", status)
	}

	return rsp
}

func readPrometheusData(iter *jsoniter.Iterator) *backend.DataResponse {
	t := iter.WhatIsNext()
	if t == jsoniter.ArrayValue {
		return readArrayData(iter)
	}

	if t != jsoniter.ObjectValue {
		return &backend.DataResponse{
			Error: fmt.Errorf("expected object type"),
		}
	}

	resultType := ""
	var rsp *backend.DataResponse

	for l1Field := iter.ReadObject(); l1Field != ""; l1Field = iter.ReadObject() {
		switch l1Field {
		case "resultType":
			resultType = iter.ReadString()

		case "result":
			switch resultType {
			case "matrix":
				rsp = readMatrixOrVector(iter)
			case "vector":
				rsp = readMatrixOrVector(iter)
			case "streams":
				rsp = readStream(iter)
			default:
				iter.Skip()
				rsp = &backend.DataResponse{
					Error: fmt.Errorf("unknown result type: %s", resultType),
				}
			}

		case "stats":
			v := iter.Read()
			fmt.Printf("[data] TODO, support stats: %v\n", v)

		default:
			v := iter.Read()
			fmt.Printf("[data] TODO, support key: %s / %v\n", l1Field, v)
		}
	}

	fmt.Printf("result: %s\n", resultType)
	return rsp
}

// will always return strings for now
func readArrayData(iter *jsoniter.Iterator) *backend.DataResponse {
	lookup := make(map[string]*data.Field)

	rsp := &backend.DataResponse{}
	stringField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	stringField.Name = "Value"
	for iter.ReadArray() {
		switch iter.WhatIsNext() {
		case jsoniter.StringValue:
			stringField.Append(iter.ReadString())

		// Either label or exemplars
		case jsoniter.ObjectValue:
			f, pairs := readLabelsOrExemplars(iter)
			if f != nil {
				rsp.Frames = append(rsp.Frames, f)
			} else if pairs != nil {
				max := 0
				for _, pair := range pairs {
					k := pair[0]
					v := pair[1]
					f, ok := lookup[k]
					if !ok {
						f = data.NewFieldFromFieldType(data.FieldTypeString, 0)
						f.Name = k
						lookup[k] = f

						if len(rsp.Frames) == 0 {
							rsp.Frames = append(rsp.Frames, data.NewFrame(""))
						}
						rsp.Frames[0].Fields = append(rsp.Frames[0].Fields, f)
					}
					f.Append(fmt.Sprintf("%v", v))
					if f.Len() > max {
						max = f.Len()
					}
				}

				for _, f := range lookup {
					if f.Len() != max {
						f.Append("") // no matching label
					}
				}
			}

		default:
			{
				ext := iter.ReadAny()
				v := fmt.Sprintf("%v", ext)
				stringField.Append(v)
			}
		}
	}

	if rsp.Frames == nil {
		rsp.Frames = data.Frames{data.NewFrame("", stringField)}
	}

	return rsp
}

// For consistent ordering read values to an aray not a map
func readLabelsAsPairs(iter *jsoniter.Iterator) [][2]string {
	pairs := make([][2]string, 0, 10)
	for k := iter.ReadObject(); k != ""; k = iter.ReadObject() {
		pairs = append(pairs, [2]string{k, iter.ReadString()})
	}
	return pairs
}

func readLabelsOrExemplars(iter *jsoniter.Iterator) (*data.Frame, [][2]string) {
	pairs := make([][2]string, 0, 10)
	labels := data.Labels{}
	var frame *data.Frame

	for l1Field := iter.ReadObject(); l1Field != ""; l1Field = iter.ReadObject() {
		switch l1Field {
		case "seriesLabels":
			iter.ReadVal(&labels)
		case "exemplars":
			lookup := make(map[string]*data.Field)
			timeField := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
			valueField := data.NewFieldFromFieldType(data.FieldTypeFloat64, 0)
			valueField.Name = labels["__name__"]
			delete(labels, "__name__")
			valueField.Labels = labels
			frame = data.NewFrame("", timeField, valueField)
			for iter.ReadArray() {
				for l2Field := iter.ReadObject(); l2Field != ""; l2Field = iter.ReadObject() {
					switch l2Field {
					// nolint:goconst
					case "value":
						v, _ := strconv.ParseFloat(iter.ReadString(), 64)
						valueField.Append(v)

					case "timestamp":
						ts := timeFromFloat(iter.ReadFloat64())
						timeField.Append(ts)

					case "labels":
						max := 0
						for _, pair := range readLabelsAsPairs(iter) {
							k := pair[0]
							v := pair[1]
							f, ok := lookup[k]
							if !ok {
								f = data.NewFieldFromFieldType(data.FieldTypeString, 0)
								f.Name = k
								lookup[k] = f
								frame.Fields = append(frame.Fields, f)
							}
							f.Append(v)
							if f.Len() > max {
								max = f.Len()
							}
						}
						for _, f := range lookup {
							if f.Len() != max {
								f.Append("") // no matching label
							}
						}
					}
				}
			}
		default:
			v := fmt.Sprintf("%v", iter.Read())
			pairs = append(pairs, [2]string{l1Field, v})
		}
	}

	return frame, pairs
}

func readMatrixOrVector(iter *jsoniter.Iterator) *backend.DataResponse {
	rsp := &backend.DataResponse{}

	for iter.ReadArray() {
		timeField := data.NewFieldFromFieldType(data.FieldTypeTime, 0) // for now!
		valueField := data.NewFieldFromFieldType(data.FieldTypeFloat64, 0)
		valueField.Labels = data.Labels{}

		for l1Field := iter.ReadObject(); l1Field != ""; l1Field = iter.ReadObject() {
			switch l1Field {
			case "metric":
				iter.ReadVal(&valueField.Labels)

			case "value":
				t, v, err := readTimeValuePair(iter)
				if err == nil {
					timeField.Append(t)
					valueField.Append(v)
				}

			// nolint:goconst
			case "values":
				for iter.ReadArray() {
					t, v, err := readTimeValuePair(iter)
					if err == nil {
						timeField.Append(t)
						valueField.Append(v)
					}
				}
			}
		}

		valueField.Name = valueField.Labels["__name__"]
		delete(valueField.Labels, "__name__")

		frame := data.NewFrame("", timeField, valueField)
		frame.Meta = &data.FrameMeta{
			Type: data.FrameTypeTimeSeriesMany,
		}
		rsp.Frames = append(rsp.Frames, frame)
	}

	return rsp
}

func readTimeValuePair(iter *jsoniter.Iterator) (time.Time, float64, error) {
	iter.ReadArray()
	t := iter.ReadFloat64()
	iter.ReadArray()
	v := iter.ReadString()
	iter.ReadArray()

	tt := timeFromFloat(t)
	fv, err := strconv.ParseFloat(v, 64)
	return tt, fv, err
}

func readStream(iter *jsoniter.Iterator) *backend.DataResponse {
	rsp := &backend.DataResponse{}

	for iter.ReadArray() {
		timeField := data.NewFieldFromFieldType(data.FieldTypeTime, 0) // for now!
		timeField.Name = "Time"
		lineField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
		lineField.Name = "Line"
		lineField.Labels = data.Labels{}

		// Nanoseconds time field
		tsField := data.NewFieldFromFieldType(data.FieldTypeString, 0)
		tsField.Name = "TS"

		for l1Field := iter.ReadObject(); l1Field != ""; l1Field = iter.ReadObject() {
			switch l1Field {
			case "stream":
				iter.ReadVal(&lineField.Labels)

			case "values":
				for iter.ReadArray() {
					iter.ReadArray()
					ts := iter.ReadString()
					iter.ReadArray()
					line := iter.ReadString()
					iter.ReadArray()

					t := timeFromLokiString(ts)

					timeField.Append(t)
					lineField.Append(line)
					tsField.Append(ts)
				}
			}
		}

		frame := data.NewFrame("", timeField, lineField, tsField)
		frame.Meta = &data.FrameMeta{}
		rsp.Frames = append(rsp.Frames, frame)
	}

	return rsp
}

func timeFromFloat(fv float64) time.Time {
	ms := int64(fv * 1000.0)
	return time.UnixMilli(ms).UTC()
}

func timeFromLokiString(str string) time.Time {
	// 1645228233
	// 1645030246277587968
	ss, _ := strconv.ParseInt(str[0:10], 10, 64)
	ns, _ := strconv.ParseInt(str[10:], 10, 64)
	return time.Unix(ss, ns).UTC()
}
