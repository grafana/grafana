package flux

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// anyToOptionalString any value as a string.
var anyToOptionalString = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableString,
	Converter: func(v interface{}) (interface{}, error) {
		if v == nil {
			return nil, nil
		}
		str := fmt.Sprintf("%+v", v) // the +v adds field names
		return &str, nil
	},
}

// float64ToOptionalFloat64 optional float value
var float64ToOptionalFloat64 = data.FieldConverter{
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

// int64ToOptionalInt64 optional int value
var int64ToOptionalInt64 = data.FieldConverter{
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

// uint64ToOptionalUInt64 optional int value
var uint64ToOptionalUInt64 = data.FieldConverter{
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

// boolToOptionalBool optional int value
var boolToOptionalBool = data.FieldConverter{
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

// timeToOptionalTime optional int value
var timeToOptionalTime = data.FieldConverter{
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
