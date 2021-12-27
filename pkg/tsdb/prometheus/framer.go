package prometheus

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/common/model"
)

type Framer struct {
	rowIdx       int
	length       int
	responseType string
	query        *PrometheusQuery
	series       []Series
	timeMap      map[int64]*int
	fields       data.Fields
}

func NewMatrixFramer(query *PrometheusQuery, matrix model.Matrix) Framer {
	length := 0
	series := make([]Series, matrix.Len())

	// get the length of the longest column first so we can reduce the need to expand
	for i, s := range matrix {
		series[i] = &MatrixSeries{stream: s, rowIdx: -1}
		if len(s.Values) > length {
			length = len(s.Values)
		}
	}

	timeMap := make(map[int64]*int, length)
	timeField := data.NewField(data.TimeSeriesTimeFieldName, nil, make([]time.Time, length))
	fields := make([]*data.Field, 1, len(matrix))
	fields[0] = timeField

	return Framer{
		rowIdx:       0,
		length:       length,
		responseType: "matrix",
		query:        query,
		series:       series,
		fields:       fields,
		timeMap:      timeMap,
	}
}

func NewVectorFramer(query *PrometheusQuery, vec model.Vector) Framer {
	length := 1
	series := make([]Series, vec.Len())

	// get the length of the longest column first so we can reduce the need to expand
	for i, s := range vec {
		series[i] = &VectorSeries{sample: s, rowIdx: -1}
	}

	timeMap := make(map[int64]*int, length)
	timeField := data.NewField(data.TimeSeriesTimeFieldName, nil, make([]time.Time, length))
	fields := make([]*data.Field, 1, len(vec))
	fields[0] = timeField

	return Framer{
		rowIdx:       0,
		length:       length,
		responseType: "vector",
		query:        query,
		series:       series,
		fields:       fields,
		timeMap:      timeMap,
	}
}

func (f *Framer) Frames() data.Frames {
	frames := make(data.Frames, 0, 1)

	for _, s := range f.series {
		valueField := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, f.length)
		valueField.Labels = make(map[string]string, len(s.Metric()))
		for k, v := range s.Metric() {
			valueField.Labels[string(k)] = string(v)
		}

		name := formatLegend(s.Metric(), f.query)
		valueField.Name = data.TimeSeriesValueFieldName
		valueField.Config = &data.FieldConfig{DisplayNameFromDS: name}
		f.fields = append(f.fields, valueField)

		for s.Next() {
			f.processRow(f.query, valueField, s)
		}
	}

	return append(frames, newDataFrame("", f.responseType, f.fields...))
}

func (f *Framer) processRow(query *PrometheusQuery, valueField *data.Field, s Series) {
	valueIdx := f.timeMap[s.Timestamp()]

	// we haven't seen this timestamp yet, so we will need to add
	// it to the map, and increment the row index
	if valueIdx == nil {
		for _, field := range f.fields {
			if field.Len() <= f.rowIdx {
				field.Extend(f.rowIdx - field.Len() + 1)
			}
		}

		if valueField.Len() <= f.rowIdx {
			valueField.Extend(f.rowIdx - valueField.Len() + 1)
		}

		ts := s.Timestamp()
		f.fields[0].Set(f.rowIdx, time.Unix(ts, 0).UTC())

		lastIdx := f.rowIdx
		valueIdx = &lastIdx
		f.timeMap[ts] = valueIdx
		f.rowIdx += 1
	}

	if s.IsSet() {
		valueField.Set(*valueIdx, s.Value())
	}
}
