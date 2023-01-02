package mathexp

import (
	"fmt"
	"sort"
	"time"

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

// SeriesFromFrame validates that the dataframe can be considered a Series type
// and mutates the frame to be in the format that additional SSE operations expect.
func SeriesFromFrame(frame *data.Frame) (s Series, err error) {
	if len(frame.Fields) != 2 {
		return s, fmt.Errorf("frame must have exactly two fields to be a series, has %v", len(frame.Fields))
	}

	valueIdx := -1
	timeIdx := -1

	timeNullable := false
	valueNullable := false

FIELDS:
	for i, field := range frame.Fields {
		switch field.Type() {
		case data.FieldTypeTime:
			timeIdx = i
		case data.FieldTypeNullableTime:
			timeNullable = true
			timeIdx = i
		case data.FieldTypeFloat64:
			valueIdx = i
		case data.FieldTypeNullableFloat64:
			valueNullable = true
			valueIdx = i
		default:
			// Handle default case
			// try to convert to *float64
			var convertedField *data.Field
			for j := 0; j < field.Len(); j++ {
				ff, err := field.NullableFloatAt(j)
				if err != nil {
					break
				}
				if convertedField == nil { // initialise field
					convertedField = data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, field.Len())
					convertedField.Name = field.Name
					convertedField.Labels = field.Labels
				}
				convertedField.Set(j, ff)
			}
			if convertedField != nil {
				frame.Fields[i] = convertedField
				valueNullable = true
				valueIdx = i
			}
			if valueIdx != -1 && timeIdx != -1 {
				break FIELDS
			}
		}
	}

	if timeIdx == -1 {
		return s, fmt.Errorf("no time column found in frame %v", frame.Name)
	}
	if valueIdx == -1 {
		return s, fmt.Errorf("no float64 value column found in frame %v", frame.Name)
	}

	if timeNullable { // make time not nullable if it is in the input
		timeSlice := make([]time.Time, 0, frame.Fields[timeIdx].Len())
		for rowIdx := 0; rowIdx < frame.Fields[timeIdx].Len(); rowIdx++ {
			val, ok := frame.At(timeIdx, rowIdx).(*time.Time)
			if !ok {
				return s, fmt.Errorf("unexpected time type, expected *time.Time but got %T", val)
			}
			if val == nil {
				return s, fmt.Errorf("time series with null time stamps are not supported")
			}
			timeSlice = append(timeSlice, *val)
		}
		nF := data.NewField(frame.Fields[timeIdx].Name, nil, timeSlice) // (labels are not used on time field)
		nF.Config = frame.Fields[timeIdx].Config
		frame.Fields[timeIdx] = nF
	}

	if !valueNullable { // make value nullable if it is not in the input
		floatSlice := make([]*float64, 0, frame.Fields[valueIdx].Len())
		for rowIdx := 0; rowIdx < frame.Fields[valueIdx].Len(); rowIdx++ {
			val, ok := frame.At(valueIdx, rowIdx).(float64)
			if !ok {
				return s, fmt.Errorf("unexpected time type, expected float64 but got %T", val)
			}
			floatSlice = append(floatSlice, &val)
		}
		nF := data.NewField(frame.Fields[valueIdx].Name, frame.Fields[valueIdx].Labels, floatSlice)
		nF.Config = frame.Fields[valueIdx].Config
		frame.Fields[valueIdx] = nF
	}

	fields := make([]*data.Field, 2)
	fields[seriesTypeTimeIdx] = frame.Fields[timeIdx]
	fields[seriesTypeValIdx] = frame.Fields[valueIdx]

	frame.Fields = fields
	s.Frame = frame

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

	return Series{
		Frame: data.NewFrame("", fields...),
	}
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
