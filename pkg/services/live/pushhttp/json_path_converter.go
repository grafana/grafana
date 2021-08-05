package pushhttp

import (
	"errors"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/live/pipeline"

	"github.com/ohler55/ojg/jp"
	"github.com/ohler55/ojg/oj"
)

type jsonPathConverter struct{}

// Automatic conversion works this way:
// * Time added automatically
// * Nulls dropped
// To preserve nulls and extract time we need tips from a user:
// * Field types
// * Time column with time format
func (c *jsonPathConverter) Convert(name string, payload []byte, exactFields []pipeline.Field) (*data.Frame, error) {
	obj, err := oj.Parse(payload)
	if err != nil {
		return nil, err
	}

	var fields []*data.Field

	for _, f := range exactFields {
		field := data.NewFieldFromFieldType(f.Type, 1)
		field.Name = f.Name
		if strings.HasPrefix(f.Value, "$") {
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
					field.Set(0, v)
				}
			} else {
				return nil, errors.New("too many values")
			}
		} else if f.Value == "#{now}" {
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
			}
		}
		field.Labels = labels

		fields = append(fields, field)
	}

	frame := data.NewFrame(name, fields...)
	s, _ := frame.StringTable(10, 10)
	println(s)

	return frame, nil
}

func newJsonPathConverter() *jsonPathConverter {
	return &jsonPathConverter{}
}
