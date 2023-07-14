package mathexp

import (
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/grafana/dataplane/sdata/timeseries"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/expr/mathexp/parse"
)

// seriesTypeTimeIdx is the data frame field index for the Series type's Time column.
const seriesTypeTimeIdx = 0

// seriesTypeValIdx is the data frame field index for the Series type's Value column.
const seriesTypeValIdx = 1

// Series has a time.Time and a *float64 fields.
type Series struct {
	Frame *data.Frame
}

// SeriesFromFrameFields creates a series from the frame fields: one time field and one value field. If value field is not a float64, it tries to convert values to float64.
// Returns Series created from time and value fields or error if the value field is not a number of indices point to fields of wrong type.
func SeriesFromFrameFields(frame *data.Frame, timeIdx, valueIdx int) (s Series, e error) {
	if len(frame.Fields) <= timeIdx {
		return s, errors.New("cannot find time field")
	}
	if len(frame.Fields) <= valueIdx {
		return s, errors.New("cannot find value field")
	}

	timeField := frame.Fields[timeIdx]
	switch timeField.Type() {
	case data.FieldTypeTime:
		// do nothing here
	case data.FieldTypeNullableTime:
		timeSlice := make([]time.Time, 0, timeField.Len())
		for rowIdx := 0; rowIdx < timeField.Len(); rowIdx++ {
			val, ok := timeField.At(rowIdx).(*time.Time)
			if !ok {
				return s, fmt.Errorf("unexpected time type, expected *time.Time but got %T", val)
			}
			if val == nil {
				return s, fmt.Errorf("time series with null time stamps are not supported")
			}
			timeSlice = append(timeSlice, *val)
		}
		nF := data.NewField(timeField.Name, nil, timeSlice) // (labels are not used on time field)
		nF.Config = timeField.Config
		timeField = nF
	default:
		return s, fmt.Errorf("invalid type %s for time field", timeField.Type())
	}

	valueField := frame.Fields[valueIdx]
	// if value field is not *float64, try to convert to it
	if valueField.Type() != data.FieldTypeNullableFloat64 {
		floatSlice := make([]*float64, 0, valueField.Len())
		for rowIdx := 0; rowIdx < valueField.Len(); rowIdx++ {
			val, err := valueField.NullableFloatAt(rowIdx)
			if err != nil {
				return s, fmt.Errorf("unexpected value type, expected float64 but got %T", valueField.Type().String())
			}
			floatSlice = append(floatSlice, val)
		}
		nF := data.NewField(valueField.Name, valueField.Labels, floatSlice)
		nF.Config = valueField.Config
		valueField = nF
	}

	fields := make([]*data.Field, 2)
	fields[seriesTypeTimeIdx] = timeField
	fields[seriesTypeValIdx] = valueField

	s.Frame = data.NewFrame(frame.Name, fields...)
	s.Frame.RefID = frame.RefID
	s.Frame.Meta = &data.FrameMeta{
		Type:        data.FrameTypeTimeSeriesMulti,
		TypeVersion: data.FrameTypeVersion{0, 1},
	}

	// We use the frame name as series name if the frame name is set
	if s.Frame.Name != "" {
		s.Frame.Fields[seriesTypeValIdx].Name = s.Frame.Name
	}

	return s, nil
}

// NewSeries returns a dataframe of type Series.
func NewSeries(refID string, labels data.Labels, size int) Series {
	fields := make([]*data.Field, 2)
	fields[seriesTypeTimeIdx] = data.NewField("Time", nil, make([]time.Time, size))
	fields[seriesTypeValIdx] = data.NewField(refID, labels, make([]*float64, size))
	frame := data.NewFrame("", fields...)
	frame.RefID = refID
	frame.Meta = &data.FrameMeta{
		Type:        data.FrameTypeTimeSeriesMulti,
		TypeVersion: data.FrameTypeVersion{0, 1},
	}

	return Series{
		Frame: frame,
	}
}

// NewSeries returns a dataframe of type Series.
func NewSeriesFromRef(refID string, s timeseries.MetricRef) (Series, error) {
	frame := data.NewFrame("")
	frame.RefID = refID
	frame.Meta = &data.FrameMeta{
		Type:        data.FrameTypeTimeSeriesMulti,
		TypeVersion: data.FrameTypeVersion{0, 1},
	}

	valField := s.ValueField
	if valField.Type() != data.FieldTypeNullableFloat64 {
		convertedField := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, valField.Len())
		convertedField.Name = valField.Name
		convertedField.Labels = valField.Labels
		convertedField.Config = valField.Config
		for j := 0; j < valField.Len(); j++ {
			ff, err := valField.NullableFloatAt(j)
			if err != nil {
				break
			}

			convertedField.Set(j, ff)
		}
		valField = convertedField
	}
	frame.Fields = []*data.Field{s.TimeField, valField}

	return Series{
		Frame: frame, // No Data Frame
	}, nil
}

// Type returns the Value type and allows it to fulfill the Value interface.
func (s Series) Type() parse.ReturnType { return parse.TypeSeriesSet }

// Value returns the actual value allows it to fulfill the Value interface.
func (s Series) Value() interface{} { return &s }

func (s Series) GetLabels() data.Labels { return s.Frame.Fields[seriesTypeValIdx].Labels }

func (s Series) SetLabels(ls data.Labels) { s.Frame.Fields[seriesTypeValIdx].Labels = ls }

func (s Series) GetName() string { return s.Frame.Fields[seriesTypeValIdx].Name }

func (s Series) GetMeta() interface{} {
	return s.Frame.Meta.Custom
}

func (s Series) SetMeta(v interface{}) {
	m := s.Frame.Meta
	if m == nil {
		m = &data.FrameMeta{}
		s.Frame.SetMeta(m)
	}
	m.Custom = v
}

func (s Series) AddNotice(notice data.Notice) {
	m := s.Frame.Meta
	if m == nil {
		m = &data.FrameMeta{}
		s.Frame.SetMeta(m)
	}
	m.Notices = append(m.Notices, notice)
}

// AsDataFrame returns the underlying *data.Frame.
func (s Series) AsDataFrame() *data.Frame { return s.Frame }

// GetPoint returns the time and value at the specified index.
func (s Series) GetPoint(pointIdx int) (time.Time, *float64) {
	return s.GetTime(pointIdx), s.GetValue(pointIdx)
}

// SetPoint sets the time and value on the corresponding vectors at the specified index.
func (s Series) SetPoint(pointIdx int, t time.Time, f *float64) {
	s.Frame.Fields[seriesTypeTimeIdx].Set(pointIdx, t)
	s.Frame.Fields[seriesTypeValIdx].Set(pointIdx, f)
}

// AppendPoint appends a point (time/value).
func (s Series) AppendPoint(t time.Time, f *float64) {
	s.Frame.Fields[seriesTypeTimeIdx].Append(t)
	s.Frame.Fields[seriesTypeValIdx].Append(f)
}

// Len returns the length of the series.
func (s Series) Len() int {
	return s.Frame.Fields[seriesTypeTimeIdx].Len()
}

// GetTime returns the time at the specified index.
func (s Series) GetTime(pointIdx int) time.Time {
	return s.Frame.Fields[seriesTypeTimeIdx].At(pointIdx).(time.Time)
}

// GetValue returns the float value at the specified index.
func (s Series) GetValue(pointIdx int) *float64 {
	return s.Frame.Fields[seriesTypeValIdx].At(pointIdx).(*float64)
}

// SortByTime sorts the series by the time from oldest to newest.
// If desc is true, it will sort from newest to oldest.
// If any time values are nil, it will panic.
func (s Series) SortByTime(desc bool) {
	if desc {
		sort.Sort(sort.Reverse(SortSeriesByTime(s)))
		return
	}
	sort.Sort(SortSeriesByTime(s))
}

// SortSeriesByTime allows a Series to be sorted by time
// the sort interface will panic if any timestamps are null
type SortSeriesByTime Series

func (ss SortSeriesByTime) Len() int { return Series(ss).Len() }

func (ss SortSeriesByTime) Swap(i, j int) {
	iTimeVal, iFVal := Series(ss).GetPoint(i)
	jTimeVal, jFVal := Series(ss).GetPoint(j)
	Series(ss).SetPoint(j, iTimeVal, iFVal)
	Series(ss).SetPoint(i, jTimeVal, jFVal)
}

func (ss SortSeriesByTime) Less(i, j int) bool {
	iTimeVal := Series(ss).GetTime(i)
	jTimeVal := Series(ss).GetTime(j)
	return iTimeVal.Before(jTimeVal)
}
