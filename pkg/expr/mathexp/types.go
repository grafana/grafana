package mathexp

import (
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/expr/mathexp/parse"
)

// Results is a container for Value interfaces.
type Results struct {
	Values Values
}

// Values is a slice of Value interfaces
type Values []Value

// AsDataFrames returns each value as a slice of frames.
func (vals Values) AsDataFrames(refID string) []*data.Frame {
	frames := make([]*data.Frame, len(vals))
	for i, v := range vals {
		frames[i] = v.AsDataFrame()
		frames[i].RefID = refID
	}
	return frames
}

// Value is the interface that holds different types such as a Scalar, Series, or Number.
// all Value implementations should be a *data.Frame
type Value interface {
	Type() parse.ReturnType
	Value() interface{}
	GetLabels() data.Labels
	SetLabels(data.Labels)
	GetMeta() interface{}
	SetMeta(interface{})
	AsDataFrame() *data.Frame
	AddNotice(notice data.Notice)
}

// Scalar is the type that holds a single number constant.
// Before returning from an expression it will be wrapped in a
// data frame.
type Scalar struct{ Frame *data.Frame }

// Type returns the Value type and allows it to fulfill the Value interface.
func (s Scalar) Type() parse.ReturnType { return parse.TypeScalar }

// Value returns the actual value allows it to fulfill the Value interface.
func (s Scalar) Value() interface{} { return s }

func (s Scalar) GetLabels() data.Labels { return nil }

func (s Scalar) SetLabels(ls data.Labels) {}

func (s Scalar) GetMeta() interface{} {
	return s.Frame.Meta.Custom
}

func (s Scalar) SetMeta(v interface{}) {
	m := s.Frame.Meta
	if m == nil {
		m = &data.FrameMeta{}
		s.Frame.SetMeta(m)
	}
	m.Custom = v
}

func (s Scalar) AddNotice(notice data.Notice) {
	m := s.Frame.Meta
	if m == nil {
		m = &data.FrameMeta{}
		s.Frame.SetMeta(m)
	}
	m.Notices = append(m.Notices, notice)
}

// AsDataFrame returns the underlying *data.Frame.
func (s Scalar) AsDataFrame() *data.Frame { return s.Frame }

// NewScalar creates a Scalar holding value f.
func NewScalar(name string, f *float64) Scalar {
	frame := data.NewFrame("",
		data.NewField(name, nil, []*float64{f}),
	)
	return Scalar{frame}
}

// NewScalarResults creates a Results holding a single Scalar
func NewScalarResults(name string, f *float64) Results {
	return Results{
		Values: []Value{NewScalar(name, f)},
	}
}

// GetFloat64Value retrieves the single scalar value from the data
func (s Scalar) GetFloat64Value() *float64 {
	return s.Frame.At(0, 0).(*float64)
}

// Number hold a labelled single number values.
type Number struct{ Frame *data.Frame }

// Type returns the Value type and allows it to fulfill the Value interface.
func (n Number) Type() parse.ReturnType { return parse.TypeNumberSet }

// Value returns the actual value allows it to fulfill the Value interface.
func (n Number) Value() interface{} { return &n }

func (n Number) GetLabels() data.Labels { return n.Frame.Fields[0].Labels }

func (n Number) SetLabels(ls data.Labels) { n.Frame.Fields[0].Labels = ls }

// AsDataFrame returns the underlying *data.Frame.
func (n Number) AsDataFrame() *data.Frame { return n.Frame }

// SetValue sets the value of the Number to float64 pointer f
func (n Number) SetValue(f *float64) {
	n.Frame.Set(0, 0, f)
}

// GetFloat64Value retrieves the single scalar value from the data
func (n Number) GetFloat64Value() *float64 {
	return n.Frame.At(0, 0).(*float64)
}

// NewNumber returns a data that holds a float64Vector
func NewNumber(name string, labels data.Labels) Number {
	return Number{
		data.NewFrame("",
			data.NewField(name, labels, make([]*float64, 1)),
		),
	}
}

func (n Number) GetMeta() interface{} {
	return n.Frame.Meta.Custom
}

func (n Number) SetMeta(v interface{}) {
	m := n.Frame.Meta
	if m == nil {
		m = &data.FrameMeta{}
		n.Frame.SetMeta(m)
	}
	m.Custom = v
}

func (n Number) AddNotice(notice data.Notice) {
	m := n.Frame.Meta
	if m == nil {
		m = &data.FrameMeta{}
		n.Frame.SetMeta(m)
	}
	m.Notices = append(m.Notices, notice)
}

// FloatField is a *float64 or a float64 data.Field with methods to always
// get a *float64.
type Float64Field data.Field

// GetValue returns the value at idx as *float64.
func (ff *Float64Field) GetValue(idx int) *float64 {
	field := data.Field(*ff)
	if field.Type() == data.FieldTypeNullableFloat64 {
		return field.At(idx).(*float64)
	}
	f := field.At(idx).(float64)
	return &f
}

// Len returns the the length of the field.
func (ff *Float64Field) Len() int {
	df := data.Field(*ff)
	return df.Len()
}
