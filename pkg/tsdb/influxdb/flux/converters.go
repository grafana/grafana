package flux

import (
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// Int64NOOP .....
var Int64NOOP = data.FieldConverter{
	OutputFieldType: data.FieldTypeInt64,
}

// BoolNOOP .....
var BoolNOOP = data.FieldConverter{
	OutputFieldType: data.FieldTypeBool,
}

// Float64NOOP .....
var Float64NOOP = data.FieldConverter{
	OutputFieldType: data.FieldTypeFloat64,
}

// StringNOOP value is already in the proper format
var StringNOOP = data.FieldConverter{
	OutputFieldType: data.FieldTypeString,
}

// AnyToOptionalString any value as a string
var AnyToOptionalString = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableString,
	Converter: func(v interface{}) (interface{}, error) {
		if v == nil {
			return nil, nil
		}
		str := fmt.Sprintf("%+v", v) // the +v adds field names
		return &str, nil
	},
}

// Float64ToOptionalFloat64 optional float value
var Float64ToOptionalFloat64 = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableFloat64,
	Converter: func(v interface{}) (interface{}, error) {
		if v == nil {
			return nil, nil
		}
		val, ok := v.(float64)
		if !ok { // or return some default value instead of erroring
			return nil, fmt.Errorf("[float] expected float64 input but got type %T", v)
		}
		return &val, nil
	},
}

// Int64ToOptionalInt64 optional int value
var Int64ToOptionalInt64 = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableInt64,
	Converter: func(v interface{}) (interface{}, error) {
		if v == nil {
			return nil, nil
		}
		val, ok := v.(int64)
		if !ok { // or return some default value instead of erroring
			return nil, fmt.Errorf("[int] expected int64 input but got type %T", v)
		}
		return &val, nil
	},
}

// UInt64ToOptionalUInt64 optional int value
var UInt64ToOptionalUInt64 = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableUint64,
	Converter: func(v interface{}) (interface{}, error) {
		if v == nil {
			return nil, nil
		}
		val, ok := v.(uint64)
		if !ok { // or return some default value instead of erroring
			return nil, fmt.Errorf("[uint] expected uint64 input but got type %T", v)
		}
		return &val, nil
	},
}

// BoolToOptionalBool optional int value
var BoolToOptionalBool = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableBool,
	Converter: func(v interface{}) (interface{}, error) {
		if v == nil {
			return nil, nil
		}
		val, ok := v.(bool)
		if !ok { // or return some default value instead of erroring
			return nil, fmt.Errorf("[bool] expected bool input but got type %T", v)
		}
		return &val, nil
	},
}

// TimeToOptionalTime optional int value
var TimeToOptionalTime = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableTime,
	Converter: func(v interface{}) (interface{}, error) {
		if v == nil {
			return nil, nil
		}
		val, ok := v.(time.Time)
		if !ok { // or return some default value instead of erroring
			return nil, fmt.Errorf("[time] expected time input but got type %T", v)
		}
		return &val, nil
	},
}

// RFC3339StringToNullableTime .....
func RFC3339StringToNullableTime(s string) (*time.Time, error) {
	if s == "" {
		return nil, nil
	}

	rv, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return nil, err
	}

	u := rv.UTC()
	return &u, nil
}

// StringToOptionalFloat64 string to float
var StringToOptionalFloat64 = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableFloat64,
	Converter: func(v interface{}) (interface{}, error) {
		if v == nil {
			return nil, nil
		}
		val, ok := v.(string)
		if !ok { // or return some default value instead of erroring
			return nil, fmt.Errorf("[floatz] expected string input but got type %T", v)
		}
		fV, err := strconv.ParseFloat(val, 64)
		return &fV, err
	},
}

// Float64EpochSecondsToTime  numeric seconds to time
var Float64EpochSecondsToTime = data.FieldConverter{
	OutputFieldType: data.FieldTypeTime,
	Converter: func(v interface{}) (interface{}, error) {
		fV, ok := v.(float64)
		if !ok { // or return some default value instead of erroring
			return nil, fmt.Errorf("[seconds] expected float64 input but got type %T", v)
		}
		return time.Unix(int64(fV), 0).UTC(), nil
	},
}

// Float64EpochMillisToTime convert to time
var Float64EpochMillisToTime = data.FieldConverter{
	OutputFieldType: data.FieldTypeTime,
	Converter: func(v interface{}) (interface{}, error) {
		fV, ok := v.(float64)
		if !ok { // or return some default value instead of erroring
			return nil, fmt.Errorf("[ms] expected float64 input but got type %T", v)
		}
		return time.Unix(0, int64(fV)*int64(time.Millisecond)).UTC(), nil
	},
}

// Boolean ...
var Boolean = data.FieldConverter{
	OutputFieldType: data.FieldTypeBool,
	Converter: func(v interface{}) (interface{}, error) {
		fV, ok := v.(bool)
		if !ok { // or return some default value instead of erroring
			return nil, fmt.Errorf("[ms] expected bool input but got type %T", v)
		}
		return fV, nil
	},
}
