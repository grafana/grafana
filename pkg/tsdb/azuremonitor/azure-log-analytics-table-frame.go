package azuremonitor

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// LogTableToFrame converts an AzureLogAnalyticsTable to a data.Frame.
func LogTableToFrame(table *AzureLogAnalyticsTable) (*data.Frame, error) {
	converterFrame, err := converterFrameForTable(table)
	if err != nil {
		return nil, err
	}
	for rowIdx, row := range table.Rows {
		for fieldIdx, field := range row {
			err = converterFrame.Set(fieldIdx, rowIdx, field)
			if err != nil {
				return nil, err
			}
		}
	}
	return converterFrame.Frame, nil
}

func converterFrameForTable(t *AzureLogAnalyticsTable) (*data.FrameInputConverter, error) {
	converters := []data.FieldConverter{}
	colNames := make([]string, len(t.Columns))
	colTypes := make([]string, len(t.Columns)) // for metadata

	for i, col := range t.Columns {
		colNames[i] = col.Name
		colTypes[i] = col.Type
		converter, ok := converterMap[col.Type]
		if !ok {
			return nil, fmt.Errorf("unsupported analytics column type %v", col.Type)
		}
		converters = append(converters, converter)
	}

	fic, err := data.NewFrameInputConverter(converters, len(t.Rows))
	if err != nil {
		return nil, err
	}

	err = fic.Frame.SetFieldNames(colNames...)
	if err != nil {
		return nil, err
	}

	fic.Frame.Meta = &data.FrameMeta{
		Custom: &LogAnalyticsMeta{ColumnTypes: colTypes},
	}

	return fic, nil
}

var converterMap = map[string]data.FieldConverter{
	"string":   stringConverter,
	"guid":     stringConverter,
	"timespan": stringConverter,
	"dynamic":  stringConverter,
	"datetime": timeConverter,
	"int":      intConverter,
	"long":     longConverter,
	"real":     realConverter,
	"bool":     boolConverter,
	"decimal":  decimalConverter,
}

var stringConverter = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableString,
	Converter: func(v interface{}) (interface{}, error) {
		var as *string
		if v == nil {
			return as, nil
		}
		s, ok := v.(string)
		if !ok {
			return nil, fmt.Errorf("unexpected type, expected string but got %T", v)
		}
		as = &s
		return as, nil
	},
}

var timeConverter = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableTime,
	Converter: func(v interface{}) (interface{}, error) {
		var at *time.Time
		if v == nil {
			return at, nil
		}
		s, ok := v.(string)
		if !ok {
			return nil, fmt.Errorf("unexpected type, expected string but got %T", v)
		}
		t, err := time.Parse(time.RFC3339Nano, s)
		if err != nil {
			return nil, err
		}

		return &t, nil
	},
}

var realConverter = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableFloat64,
	Converter: func(v interface{}) (interface{}, error) {
		var af *float64
		if v == nil {
			return af, nil
		}
		jN, ok := v.(json.Number)
		if !ok {
			s, sOk := v.(string)
			if sOk {
				switch s {
				case "Infinity":
					f := math.Inf(0)
					return &f, nil
				case "-Infinity":
					f := math.Inf(-1)
					return &f, nil
				case "NaN":
					f := math.NaN()
					return &f, nil
				}
			}
			return nil, fmt.Errorf("unexpected type, expected json.Number but got type %T for value %v", v, v)
		}
		f, err := jN.Float64()
		if err != nil {
			return nil, err
		}
		return &f, err
	},
}

var boolConverter = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableBool,
	Converter: func(v interface{}) (interface{}, error) {
		var ab *bool
		if v == nil {
			return ab, nil
		}
		b, ok := v.(bool)
		if !ok {
			return nil, fmt.Errorf("unexpected type, expected bool but got %T", v)
		}
		return &b, nil
	},
}

var intConverter = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableInt32,
	Converter: func(v interface{}) (interface{}, error) {
		var ai *int32
		if v == nil {
			return ai, nil
		}
		jN, ok := v.(json.Number)
		if !ok {
			return nil, fmt.Errorf("unexpected type, expected json.Number but got %T", v)
		}
		var err error
		iv, err := strconv.ParseInt(jN.String(), 10, 32)
		if err != nil {
			return nil, err
		}
		aInt := int32(iv)
		return &aInt, nil
	},
}

var longConverter = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableInt64,
	Converter: func(v interface{}) (interface{}, error) {
		var ai *int64
		if v == nil {
			return ai, nil
		}
		jN, ok := v.(json.Number)
		if !ok {
			return nil, fmt.Errorf("unexpected type, expected json.Number but got %T", v)
		}
		out, err := jN.Int64()
		if err != nil {
			return nil, err
		}
		return &out, err
	},
}

// decimalConverter converts the Kusto 128-bit type number to
// a float64. We do not have 128 bit numbers in our dataframe
// model yet (and even if we did, not sure how javascript would handle them).
// In the future, we may want to revisit storing this will proper precision,
// but for now it solves the case of people getting an error response.
// If we were to keep it a string, it would not work correctly with calls
// to functions like sdk's data.LongToWide.
var decimalConverter = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableFloat64,
	Converter: func(v interface{}) (interface{}, error) {
		var af *float64
		if v == nil {
			return af, nil
		}

		jS, sOk := v.(string)
		if sOk {
			out, err := strconv.ParseFloat(jS, 64)
			if err != nil {
				return nil, err
			}
			return &out, err
		}

		// As far as I can tell this always comes in a string, but this is in the
		// ADX code, so leaving this in case values do sometimes become a number somehow.
		jN, nOk := v.(json.Number)
		if !nOk {
			return nil, fmt.Errorf("unexpected type, expected json.Number or string but got type %T with a value of %v", v, v)
		}
		out, err := jN.Float64() // Float64 calls strconv.ParseFloat64
		if err != nil {
			return nil, err
		}
		return &out, nil
	},
}
