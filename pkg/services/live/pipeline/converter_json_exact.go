package pipeline

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/ohler55/ojg/jp"
	"github.com/ohler55/ojg/oj"
)

type ExactJsonConverterConfig struct {
	Fields []Field
}

type ExactJsonConverter struct {
	config ExactJsonConverterConfig
}

func NewExactJsonConverter(c ExactJsonConverterConfig) *ExactJsonConverter {
	return &ExactJsonConverter{config: c}
}

// Automatic conversion works this way:
// * Time added automatically
// * Nulls dropped
// To preserve nulls and extract time we need tips from a user:
// * Field types
// * Time column with time format
func (c *ExactJsonConverter) Convert(_ context.Context, vars Vars, payload []byte) (*data.Frame, error) {
	obj, err := oj.Parse(payload)
	if err != nil {
		return nil, err
	}

	var fields []*data.Field

	for _, f := range c.config.Fields {
		field := data.NewFieldFromFieldType(f.Type, 1)
		field.Name = f.Name
		if strings.HasPrefix(f.Value, "$") {
			// JSON path.
			x, err := jp.ParseString(f.Value[1:])
			if err != nil {
				return nil, err
			}
			value := x.Get(obj)
			if len(value) == 0 {
				field.Set(0, nil)
			} else if len(value) == 1 {
				val := value[0]
				switch f.Type {
				case data.FieldTypeNullableFloat64:
					if val == nil {
						field.Set(0, nil)
					} else {
						switch v := val.(type) {
						case float64:
							field.SetConcrete(0, v)
						case int64:
							field.SetConcrete(0, float64(v))
						default:
							return nil, errors.New("malformed float64 type for: " + f.Name)
						}
					}
				case data.FieldTypeNullableString:
					v, ok := val.(string)
					if !ok {
						return nil, errors.New("malformed string type")
					}
					field.SetConcrete(0, v)
				}
			} else {
				return nil, errors.New("too many values")
			}
		} else if strings.HasPrefix(f.Value, "{") {
			// Goja script.
			// TODO: reuse vm for JSON parsing.
			script := strings.Trim(f.Value, "{}")
			switch f.Type {
			case data.FieldTypeNullableBool:
				v, err := GetBool(payload, script)
				if err != nil {
					return nil, err
				}
				field.SetConcrete(0, v)
			case data.FieldTypeNullableFloat64:
				v, err := GetFloat64(payload, script)
				if err != nil {
					return nil, err
				}
				field.SetConcrete(0, v)
			}
		} else if f.Value == "#{now}" {
			// Variable.
			// TODO: make consistent with Grafana variables?
			field.SetConcrete(0, time.Now())
		}

		labels := map[string]string{}
		for _, label := range f.Labels {
			if strings.HasPrefix(label.Value, "$") {
				x, err := jp.ParseString(label.Value[1:])
				if err != nil {
					return nil, err
				}
				value := x.Get(obj)
				if len(value) == 0 {
					labels[label.Name] = ""
				} else if len(value) == 1 {
					val, ok := value[0].(string)
					if ok {
						labels[label.Name] = val
					}
				} else {
					return nil, errors.New("too many values for a label")
				}
			} else if strings.HasPrefix(label.Value, "{") {
				script := strings.Trim(f.Value, "{}")
				v, err := GetString(payload, script)
				if err != nil {
					return nil, err
				}
				labels[label.Name] = v
			}
		}
		field.Labels = labels
		fields = append(fields, field)
	}

	frame := data.NewFrame(vars.Path, fields...)
	//s, _ := frame.StringTable(10, 10)
	//println(s)
	return frame, nil
}
