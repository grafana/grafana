package telegraf

import (
	"fmt"
	"sort"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/converters"
	influx "github.com/influxdata/line-protocol"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/live/telemetry"
)

var (
	logger = log.New("live.telemetry.telegraf")
)

var _ telemetry.Converter = (*Converter)(nil)

// Converter converts Telegraf metrics to Grafana frames.
type Converter struct {
	parser            *influx.Parser
	useLabelsColumn   bool
	useFloat64Numbers bool
}

// ConverterOption ...
type ConverterOption func(*Converter)

// WithUseLabelsColumn ...
func WithUseLabelsColumn(enabled bool) ConverterOption {
	return func(h *Converter) {
		h.useLabelsColumn = enabled
	}
}

// WithFloat64Numbers will convert all numbers met to float64 type.
func WithFloat64Numbers(enabled bool) ConverterOption {
	return func(h *Converter) {
		h.useFloat64Numbers = enabled
	}
}

// NewConverter creates new Converter from Influx/Telegraf format to Grafana Data Frames.
// This converter generates one frame for each input metric name and time combination.
func NewConverter(opts ...ConverterOption) *Converter {
	c := &Converter{
		parser: influx.NewParser(influx.NewMetricHandler()),
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// Each unique metric frame identified by name and time.
func getFrameKey(m influx.Metric) string {
	return m.Name() + "_" + m.Time().String()
}

// Convert metrics.
func (c *Converter) Convert(body []byte) ([]telemetry.FrameWrapper, error) {
	metrics, err := c.parser.Parse(body)
	if err != nil {
		return nil, fmt.Errorf("error parsing metrics: %w", err)
	}
	if !c.useLabelsColumn {
		return c.convertWideFields(metrics)
	}
	return c.convertWithLabelsColumn(metrics)
}

func (c *Converter) convertWideFields(metrics []influx.Metric) ([]telemetry.FrameWrapper, error) {
	// maintain the order of frames as they appear in input.
	var frameKeyOrder []string
	metricFrames := make(map[string]*metricFrame)

	for _, m := range metrics {
		frameKey := getFrameKey(m)
		frame, ok := metricFrames[frameKey]
		if ok {
			// Existing frame.
			err := frame.extend(m)
			if err != nil {
				return nil, err
			}
		} else {
			frameKeyOrder = append(frameKeyOrder, frameKey)
			frame = newMetricFrame(m, c.useFloat64Numbers)
			err := frame.extend(m)
			if err != nil {
				return nil, err
			}
			metricFrames[frameKey] = frame
		}
	}

	frameWrappers := make([]telemetry.FrameWrapper, 0, len(metricFrames))
	for _, key := range frameKeyOrder {
		frameWrappers = append(frameWrappers, metricFrames[key])
	}

	return frameWrappers, nil
}

func (c *Converter) convertWithLabelsColumn(metrics []influx.Metric) ([]telemetry.FrameWrapper, error) {
	// maintain the order of frames as they appear in input.
	var frameKeyOrder []string
	metricFrames := make(map[string]*metricFrame)

	for _, m := range metrics {
		frameKey := m.Name()
		frame, ok := metricFrames[frameKey]
		if ok {
			// Existing frame.
			err := frame.append(m)
			if err != nil {
				return nil, err
			}
		} else {
			frameKeyOrder = append(frameKeyOrder, frameKey)
			frame = newMetricFrameLabelsColumn(m, c.useFloat64Numbers)
			err := frame.append(m)
			if err != nil {
				return nil, err
			}
			metricFrames[frameKey] = frame
		}
	}

	frameWrappers := make([]telemetry.FrameWrapper, 0, len(metricFrames))
	for _, key := range frameKeyOrder {
		frame := metricFrames[key]
		// For all fields except labels and time fill columns with nulls in
		// case of unequal length.
		for i := 2; i < len(frame.fields); i++ {
			if frame.fields[i].Len() < frame.fields[0].Len() {
				numNulls := frame.fields[0].Len() - frame.fields[i].Len()
				for j := 0; j < numNulls; j++ {
					frame.fields[i].Append(nil)
				}
			}
		}
		frameWrappers = append(frameWrappers, frame)
	}

	return frameWrappers, nil
}

type metricFrame struct {
	useFloatNumbers bool
	key             string
	fields          []*data.Field
	fieldCache      map[string]int
}

// newMetricFrame will return a new frame with length 1.
func newMetricFrame(m influx.Metric, useFloatNumbers bool) *metricFrame {
	s := &metricFrame{
		useFloatNumbers: useFloatNumbers,
		key:             m.Name(),
		fields:          make([]*data.Field, 1),
	}
	s.fields[0] = data.NewField("time", nil, []time.Time{m.Time()})
	return s
}

// newMetricFrame will return a new frame with length 1.
func newMetricFrameLabelsColumn(m influx.Metric, useFloatNumbers bool) *metricFrame {
	s := &metricFrame{
		useFloatNumbers: useFloatNumbers,
		key:             m.Name(),
		fields:          make([]*data.Field, 2),
		fieldCache:      map[string]int{},
	}
	s.fields[0] = data.NewField("labels", nil, []string{})
	s.fields[1] = data.NewField("time", nil, []time.Time{})
	return s
}

// Key returns a key which describes Frame metrics.
func (s *metricFrame) Key() string {
	return s.key
}

// Frame transforms metricFrame to Grafana data.Frame.
func (s *metricFrame) Frame() *data.Frame {
	return data.NewFrame(s.key, s.fields...)
}

// extend existing metricFrame fields.
func (s *metricFrame) extend(m influx.Metric) error {
	fields := m.FieldList()
	sort.Slice(fields, func(i, j int) bool {
		return fields[i].Key < fields[j].Key
	})
	labels := tagsToLabels(m.TagList())
	for _, f := range fields {
		ft, v, err := s.getFieldTypeAndValue(f)
		if err != nil {
			return err
		}
		field := data.NewFieldFromFieldType(ft, 1)
		field.Name = f.Key
		field.Labels = labels
		field.Set(0, v)
		s.fields = append(s.fields, field)
	}
	return nil
}

func tagsToLabels(tags []*influx.Tag) data.Labels {
	labels := data.Labels{}
	for i := 0; i < len(tags); i += 1 {
		labels[tags[i].Key] = tags[i].Value
	}
	return labels
}

// append to existing metricFrame fields.
func (s *metricFrame) append(m influx.Metric) error {
	s.fields[0].Append(tagsToLabels(m.TagList()).String()) // TODO, use labels.String()
	s.fields[1].Append(m.Time())

	fields := m.FieldList()
	sort.Slice(fields, func(i, j int) bool {
		return fields[i].Key < fields[j].Key
	})

	for _, f := range fields {
		ft, v, err := s.getFieldTypeAndValue(f)
		if err != nil {
			return err
		}
		if index, ok := s.fieldCache[f.Key]; ok {
			field := s.fields[index]
			if ft != field.Type() {
				logger.Warn("error appending values", "type", field.Type(), "expect", ft, "value", v, "key", f.Key, "line", m)
				if field.Type() == data.FieldTypeNullableString && v != nil {
					str := fmt.Sprintf("%v", f.Value)
					v = &str
				} else {
					v = nil
				}
			}
			// If field does not have a desired length till this moment
			// we fill it with nulls up to the currently processed index.
			if field.Len() < s.fields[0].Len()-1 {
				numNulls := s.fields[0].Len() - 1 - field.Len()
				for i := 0; i < numNulls; i++ {
					field.Append(nil)
				}
			}
			field.Append(v)
		} else {
			field := data.NewFieldFromFieldType(ft, 0)
			field.Name = f.Key
			// If field appeared at the moment when we already filled some columns
			// we fill it with nulls up to the currently processed index.
			if field.Len() < s.fields[0].Len()-1 {
				numNulls := s.fields[0].Len() - 1 - field.Len()
				for i := 0; i < numNulls; i++ {
					field.Append(nil)
				}
			}
			field.Append(v)
			s.fields = append(s.fields, field)
			s.fieldCache[f.Key] = len(s.fields) - 1
		}
	}
	return nil
}

// float64FieldTypeFor converts all numbers to float64.
// The precision can be lost during big int64 or uint64 conversion to float64.
func float64FieldTypeFor(t interface{}) data.FieldType {
	switch t.(type) {
	case int8:
		return data.FieldTypeFloat64
	case int16:
		return data.FieldTypeFloat64
	case int32:
		return data.FieldTypeFloat64
	case int64:
		return data.FieldTypeFloat64

	case uint8:
		return data.FieldTypeFloat64
	case uint16:
		return data.FieldTypeFloat64
	case uint32:
		return data.FieldTypeFloat64
	case uint64:
		return data.FieldTypeFloat64

	case float32:
		return data.FieldTypeFloat64
	case float64:
		return data.FieldTypeFloat64
	case bool:
		return data.FieldTypeBool
	case string:
		return data.FieldTypeString
	case time.Time:
		return data.FieldTypeTime
	}
	return data.FieldTypeUnknown
}

func (s *metricFrame) getFieldTypeAndValue(f *influx.Field) (data.FieldType, interface{}, error) {
	var ft data.FieldType
	if s.useFloatNumbers {
		ft = float64FieldTypeFor(f.Value)
	} else {
		ft = data.FieldTypeFor(f.Value)
	}
	if ft == data.FieldTypeUnknown {
		return ft, nil, fmt.Errorf("unknown type: %t", f.Value)
	}

	// Make all fields nullable.
	ft = ft.NullableType()

	convert, ok := getConvertFunc(ft)
	if !ok {
		return ft, nil, fmt.Errorf("no converter %s=%v (%T) %s", f.Key, f.Value, f.Value, ft.ItemTypeString())
	}

	v, err := convert(f.Value)
	if err != nil {
		return ft, nil, fmt.Errorf("value convert error: %v", err)
	}
	if ft == data.FieldTypeNullableString {
		// We observed commercial Telegraf extensions that send NaN values as strings.
		// Native Telegraf influx serializer drops fields with NaN values. While this
		// fixes an observed scenario we still need to think on a more generic approach
		// how to handle occasionally missing fields (maybe on a UI, maybe on a backend side).
		if stringVal, ok := v.(*string); ok && stringVal != nil && *stringVal == "NaN" {
			return data.FieldTypeNullableFloat64, nil, nil
		}
	}
	return ft, v, nil
}

func getConvertFunc(ft data.FieldType) (func(v interface{}) (interface{}, error), bool) {
	var convert func(v interface{}) (interface{}, error)
	switch ft {
	case data.FieldTypeNullableString:
		convert = converters.AnyToNullableString.Converter
	case data.FieldTypeNullableFloat64:
		convert = converters.JSONValueToNullableFloat64.Converter
	case data.FieldTypeNullableBool:
		convert = converters.BoolToNullableBool.Converter
	case data.FieldTypeNullableInt64:
		convert = converters.JSONValueToNullableInt64.Converter
	default:
		return nil, false
	}
	return convert, true
}
