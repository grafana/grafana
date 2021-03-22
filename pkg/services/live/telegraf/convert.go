package telegraf

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/converters"
	"github.com/influxdata/telegraf"
)

// MetricConverter converts Telegraf metrics to Grafana frames.
type MetricConverter struct{}

// NewMetricConverter creates new MetricConverter.
func NewMetricConverter() *MetricConverter {
	return &MetricConverter{}
}

// Each unique metric frame identified by name and time.
func getBatchKey(m telegraf.Metric) string {
	return m.Name() + "_" + m.Time().String()
}

// Convert metrics.
func (c *MetricConverter) Convert(metrics []telegraf.Metric) (map[string]*MetricFrame, error) {
	batch := make(map[string]*MetricFrame)

	for _, m := range metrics {
		var metricFrame *MetricFrame
		var ok bool
		batchKey := getBatchKey(m)
		metricFrame, ok = batch[batchKey]
		if ok {
			// Existing time frame.
			err := metricFrame.Extend(m)
			if err != nil {
				return nil, err
			}
		} else {
			var err error
			metricFrame, err = NewMetricFrame(m)
			if err != nil {
				logger.Error("Error making frame", "error", err)
				continue
			}
			err = metricFrame.Extend(m)
			if err != nil {
				return nil, err
			}
			batch[batchKey] = metricFrame
		}
	}
	return batch, nil
}

type MetricFrame struct {
	Key string

	fields []*data.Field
}

// NewMetricFrame will return a new frame with length 1.
func NewMetricFrame(m telegraf.Metric) (*MetricFrame, error) {
	s := &MetricFrame{
		Key:    m.Name(),
		fields: make([]*data.Field, 1),
	}
	s.fields[0] = data.NewField("time", nil, []time.Time{m.Time()})
	return s, nil
}

// Frame transforms MetricFrame to Grafana data.Frame.
func (s MetricFrame) Frame() *data.Frame {
	return data.NewFrame(s.Key, s.fields...)
}

// Extend existing MetricFrame fields.
func (s *MetricFrame) Extend(m telegraf.Metric) error {
	for _, f := range m.FieldList() {
		ft := data.FieldTypeFor(f.Value)
		if ft == data.FieldTypeUnknown {
			return fmt.Errorf("unknown type: %t", f.Value)
		}

		// Make all fields nullable.
		ft = ft.NullableType()

		// NOTE (FZambia): field pool?
		field := data.NewFieldFromFieldType(ft, 1)
		field.Name = f.Key
		field.Labels = m.Tags()

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
			return fmt.Errorf("no converter %s=%v (%T) %s\n", f.Key, f.Value, f.Value, ft.ItemTypeString())
		}

		if v, err := convert(f.Value); err == nil {
			field.Set(0, v)
		}
		s.fields = append(s.fields, field)
	}
	return nil
}
