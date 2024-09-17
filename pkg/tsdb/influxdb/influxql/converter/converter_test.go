package converter

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
)

func TestMaybeFixValueFieldType(t *testing.T) {
	tests := []struct {
		name         string
		valueFields  data.Fields
		inputType    data.FieldType
		colIdx       int
		expectedType data.FieldType
	}{
		{
			name:         "should do nothing if both are the same type (bool)",
			valueFields:  data.Fields{data.NewFieldFromFieldType(data.FieldTypeNullableBool, 0)},
			inputType:    data.FieldTypeNullableBool,
			colIdx:       0,
			expectedType: data.FieldTypeNullableBool,
		},
		{
			name:         "should do nothing if both are the same type (string)",
			valueFields:  data.Fields{data.NewFieldFromFieldType(data.FieldTypeNullableString, 0)},
			inputType:    data.FieldTypeNullableString,
			colIdx:       0,
			expectedType: data.FieldTypeNullableString,
		},
		{
			name:         "should do nothing if both are the same type (float64)",
			valueFields:  data.Fields{data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, 0)},
			inputType:    data.FieldTypeNullableFloat64,
			colIdx:       0,
			expectedType: data.FieldTypeNullableFloat64,
		},
		{
			name:         "should return nullableJson if both are nullableJson",
			valueFields:  data.Fields{data.NewFieldFromFieldType(data.FieldTypeNullableJSON, 0)},
			inputType:    data.FieldTypeNullableJSON,
			colIdx:       0,
			expectedType: data.FieldTypeNullableJSON,
		},
		{
			name:         "should return nullableString if valueField is nullableJson and input is nullableString",
			valueFields:  data.Fields{data.NewFieldFromFieldType(data.FieldTypeNullableJSON, 0)},
			inputType:    data.FieldTypeNullableString,
			colIdx:       0,
			expectedType: data.FieldTypeNullableString,
		},
		{
			name:         "should return nullableBool if valueField is nullableJson and input is nullableBool",
			valueFields:  data.Fields{data.NewFieldFromFieldType(data.FieldTypeNullableJSON, 0)},
			inputType:    data.FieldTypeNullableBool,
			colIdx:       0,
			expectedType: data.FieldTypeNullableBool,
		},
		{
			name:         "should return nullableFloat64 if valueField is nullableJson and input is nullableFloat64",
			valueFields:  data.Fields{data.NewFieldFromFieldType(data.FieldTypeNullableJSON, 0)},
			inputType:    data.FieldTypeNullableFloat64,
			colIdx:       0,
			expectedType: data.FieldTypeNullableFloat64,
		},
		{
			name:         "should do nothing if valueField is different than nullableJson and input is anything but nullableJson",
			valueFields:  data.Fields{data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, 0)},
			inputType:    data.FieldTypeNullableString,
			colIdx:       0,
			expectedType: data.FieldTypeNullableFloat64,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			maybeFixValueFieldType(tt.valueFields, tt.inputType, tt.colIdx)
			assert.Equal(t, tt.valueFields[tt.colIdx].Type(), tt.expectedType)
		})
	}
}
