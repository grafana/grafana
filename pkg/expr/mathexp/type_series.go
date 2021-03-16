package mathexp

import (
	"fmt"
	"sort"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr/mathexp/parse"
)

// Series has time.Time and ...? *float64 fields.
type Series struct {
	Frame           *data.Frame
	TimeIsNullable  bool
	TimeIdx         int
	ValueIsNullable bool
	ValueIdx        int
	// TODO:
	// - Multiple Value Fields
	// - Value can be different number types
}

// SeriesFromFrame validates that the dataframe can be considered a Series type
// and populate meta information on Series about the frame.
func SeriesFromFrame(frame *data.Frame) (s Series, err error) {
	if len(frame.Fields) != 2 {
		return s, fmt.Errorf("frame must have exactly two fields to be a series, has %v", len(frame.Fields))
	}

	foundTime := false
	foundValue := false
	for i, field := range frame.Fields {
		switch field.Type() {
		case data.FieldTypeTime:
			s.TimeIdx = i
			foundTime = true
		case data.FieldTypeNullableTime:
			s.TimeIsNullable = true
			foundTime = true
			s.TimeIdx = i
		case data.FieldTypeFloat64:
			foundValue = true
			s.ValueIdx = i
		case data.FieldTypeNullableFloat64:
			s.ValueIsNullable = true
			foundValue = true
			s.ValueIdx = i
		default:
			// Handle default case
		}
	}
	if !foundTime {
		return s, fmt.Errorf("no time column found in frame %v", frame.Name)
	}
	if !foundValue {
		return s, fmt.Errorf("no float64 value column found in frame %v", frame.Name)
	}
	s.Frame = frame
	return s, nil
}

// NewSeries returns a dataframe of type Series.
func NewSeries(refID string, labels data.Labels, timeIdx int, nullableTime bool, valueIdx int, nullableValue bool, size int) Series {
	fields := make([]*data.Field, 2)

	if nullableValue {
		fields[valueIdx] = data.NewField(refID, labels, make([]*float64, size))
	} else {
		fields[valueIdx] = data.NewField(refID, labels, make([]float64, size))
	}

	if nullableTime {
		fields[timeIdx] = data.NewField("Time", nil, make([]*time.Time, size))
	} else {
		fields[timeIdx] = data.NewField("Time", nil, make([]time.Time, size))
	}

	return Series{
		Frame:           data.NewFrame("", fields...),
		TimeIsNullable:  nullableTime,
		TimeIdx:         timeIdx,
		ValueIsNullable: nullableValue,
		ValueIdx:        valueIdx,
	}
}

// Type returns the Value type and allows it to fulfill the Value interface.
func (s Series) Type() parse.ReturnType { return parse.TypeSeriesSet }

// Value returns the actual value allows it to fulfill the Value interface.
func (s Series) Value() interface{} { return &s }

func (s Series) GetLabels() data.Labels { return s.Frame.Fields[s.ValueIdx].Labels }

func (s Series) SetLabels(ls data.Labels) { s.Frame.Fields[s.ValueIdx].Labels = ls }

func (s Series) GetName() string { return s.Frame.Name }

// AsDataFrame returns the underlying *data.Frame.
func (s Series) AsDataFrame() *data.Frame { return s.Frame }

// GetPoint returns the time and value at the specified index.
func (s Series) GetPoint(pointIdx int) (*time.Time, *float64) {
	return s.GetTime(pointIdx), s.GetValue(pointIdx)
}

// SetPoint sets the time and value on the corresponding vectors at the specified index.
func (s Series) SetPoint(pointIdx int, t *time.Time, f *float64) (err error) {
	if s.TimeIsNullable {
		s.Frame.Fields[s.TimeIdx].Set(pointIdx, t)
	} else {
		if t == nil {
			return fmt.Errorf("can not set null time value on non-nullable time field for series name %v", s.Frame.Name)
		}
		s.Frame.Fields[s.TimeIdx].Set(pointIdx, *t)
	}
	if s.ValueIsNullable {
		s.Frame.Fields[s.ValueIdx].Set(pointIdx, f)
	} else {
		if f == nil {
			return fmt.Errorf("can not set null float value on non-nullable float field for series name %v", s.Frame.Name)
		}
		s.Frame.Fields[s.ValueIdx].Set(pointIdx, *f)
	}
	return
}

// AppendPoint appends a point (time/value).
func (s Series) AppendPoint(pointIdx int, t *time.Time, f *float64) (err error) {
	if s.TimeIsNullable {
		s.Frame.Fields[s.TimeIdx].Append(t)
	} else {
		if t == nil {
			return fmt.Errorf("can not append null time value on non-nullable time field for series name %v", s.Frame.Name)
		}
		s.Frame.Fields[s.TimeIdx].Append(*t)
	}
	if s.ValueIsNullable {
		s.Frame.Fields[s.ValueIdx].Append(f)
	} else {
		if f == nil {
			return fmt.Errorf("can not append null float value on non-nullable float field for series name %v", s.Frame.Name)
		}
		s.Frame.Fields[s.ValueIdx].Append(*f)
	}
	return
}

// Len returns the length of the series.
func (s Series) Len() int {
	return s.Frame.Fields[0].Len()
}

// GetTime returns the time at the specified index.
func (s Series) GetTime(pointIdx int) *time.Time {
	if s.TimeIsNullable {
		return s.Frame.Fields[s.TimeIdx].At(pointIdx).(*time.Time)
	}
	t := s.Frame.Fields[s.TimeIdx].At(pointIdx).(time.Time)
	return &t
}

// GetValue returns the float value at the specified index.
func (s Series) GetValue(pointIdx int) *float64 {
	if s.ValueIsNullable {
		return s.Frame.Fields[s.ValueIdx].At(pointIdx).(*float64)
	}
	f := s.Frame.Fields[s.ValueIdx].At(pointIdx).(float64)
	return &f
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
	_ = Series(ss).SetPoint(j, iTimeVal, iFVal)
	_ = Series(ss).SetPoint(i, jTimeVal, jFVal)
}

func (ss SortSeriesByTime) Less(i, j int) bool {
	iTimeVal := Series(ss).GetTime(i)
	jTimeVal := Series(ss).GetTime(j)
	return iTimeVal.Before(*jTimeVal)
}
