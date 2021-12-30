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
	timeField := data.NewField(data.TimeSeriesTimeFieldName, nil, make([]time.Time, 0, length))
	fields := []*data.Field{timeField}

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

	for i, s := range vec {
		series[i] = &VectorSeries{sample: s, rowIdx: -1}
	}

	timeMap := make(map[int64]*int)
	timeField := data.NewField(data.TimeSeriesTimeFieldName, nil, make([]time.Time, 0, length))
	fields := []*data.Field{timeField}

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
	frames := make(data.Frames, 0)

	if len(f.series) == 0 {
		return frames
	}

	for _, s := range f.series {
		valueField := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, f.fields[0].Len())
		f.fields = append(f.fields, valueField)
		valueField.Name = formatLegend(s.Metric(), f.query)
		valueField.Labels = make(map[string]string, len(s.Metric()))
		for k, v := range s.Metric() {
			valueField.Labels[string(k)] = string(v)
		}

		for s.Next() {
			f.processRow(f.query, s)
		}
	}

	return append(frames, newDataFrame("", f.responseType, f.fields...))
}

func (f *Framer) processRow(query *PrometheusQuery, s Series) {
	ts := s.Timestamp()
	valueField := f.fields[len(f.fields)-1]
	timeField := f.fields[0]
	timeIdx := f.timeMap[ts]

	// if timeIdx is nil, then we haven't seen this timestamp yet
	if timeIdx == nil {
		timeField.Append(time.Unix(ts, 0).UTC())

		// extend all of the fields to match the length of the time field
		for _, field := range f.fields {
			if field.Len() < timeField.Len() {
				field.Extend(timeField.Len() - field.Len())
			}
		}

		// make a copy of the current row index, and add it to the time map before incrementing
		lastIdx := f.rowIdx
		timeIdx = &lastIdx
		f.timeMap[ts] = &lastIdx
		f.rowIdx += 1
	}

	if s.IsSet() {
		valueField.Set(*timeIdx, s.Value())
	}
}
