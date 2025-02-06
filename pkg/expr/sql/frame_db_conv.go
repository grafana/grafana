//go:build !arm

package sql

import (
	"errors"
	"fmt"
	"io"
	"time"

	mysql "github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/shopspring/decimal"
)

// TODO: Should this accept a row limit and converters, like sqlutil.FrameFromRows?
func convertToDataFrame(ctx *mysql.Context, iter mysql.RowIter, schema mysql.Schema) (*data.Frame, error) {
	f := &data.Frame{}
	// Create fields based on the schema
	for _, col := range schema {
		fT, err := MySQLColToFieldType(col)
		if err != nil {
			return nil, err
		}

		field := data.NewFieldFromFieldType(fT, 0)
		field.Name = col.Name
		f.Fields = append(f.Fields, field)
	}

	// Iterate through the rows and append data to fields
	for {
		row, err := iter.Next(ctx)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("error reading row: %v", err)
		}

		for i, val := range row {
			v, err := fieldValFromRowVal(f.Fields[i].Type(), val)
			if err != nil {
				return nil, fmt.Errorf("unexpected type for column %s: %w", schema[i].Name, err)
			}
			f.Fields[i].Append(v)
		}
	}

	return f, nil
}

// MySQLColToFieldType converts a MySQL column to a data.FieldType
func MySQLColToFieldType(col *mysql.Column) (data.FieldType, error) {
	var fT data.FieldType

	switch col.Type {
	case types.Int8:
		fT = data.FieldTypeInt8
	case types.Uint8:
		fT = data.FieldTypeUint8
	case types.Int16:
		fT = data.FieldTypeInt16
	case types.Uint16:
		fT = data.FieldTypeUint16
	case types.Int32:
		fT = data.FieldTypeInt32
	case types.Uint32:
		fT = data.FieldTypeUint32
	case types.Int64:
		fT = data.FieldTypeInt64
	case types.Uint64:
		fT = data.FieldTypeUint64
	case types.Float64:
		fT = data.FieldTypeFloat64
	// StringType represents all string types, including VARCHAR and BLOB.
	case types.Text, types.LongText:
		fT = data.FieldTypeString
	case types.Timestamp:
		fT = data.FieldTypeTime
	case types.Datetime:
		fT = data.FieldTypeTime
	case types.Boolean:
		fT = data.FieldTypeBool
	default:
		if types.IsDecimal(col.Type) {
			fT = data.FieldTypeFloat64
		} else {
			return fT, fmt.Errorf("unsupported type for column %s of type %v", col.Name, col.Type)
		}
	}

	if col.Nullable {
		fT = fT.NullableType()
	}

	return fT, nil
}

// Helper function to convert data.FieldType to types.Type
func convertDataType(fieldType data.FieldType) mysql.Type {
	switch fieldType {
	case data.FieldTypeInt8, data.FieldTypeNullableInt8:
		return types.Int8
	case data.FieldTypeUint8, data.FieldTypeNullableUint8:
		return types.Uint8
	case data.FieldTypeInt16, data.FieldTypeNullableInt16:
		return types.Int16
	case data.FieldTypeUint16, data.FieldTypeNullableUint16:
		return types.Uint16
	case data.FieldTypeInt32, data.FieldTypeNullableInt32:
		return types.Int32
	case data.FieldTypeUint32, data.FieldTypeNullableUint32:
		return types.Uint32
	case data.FieldTypeInt64, data.FieldTypeNullableInt64:
		return types.Int64
	case data.FieldTypeUint64, data.FieldTypeNullableUint64:
		return types.Uint64
	case data.FieldTypeFloat32, data.FieldTypeNullableFloat32:
		return types.Float32
	case data.FieldTypeFloat64, data.FieldTypeNullableFloat64:
		return types.Float64
	case data.FieldTypeString, data.FieldTypeNullableString:
		return types.Text
	case data.FieldTypeBool, data.FieldTypeNullableBool:
		return types.Boolean
	case data.FieldTypeTime, data.FieldTypeNullableTime:
		return types.Timestamp
	default:
		fmt.Printf("------- Unsupported field type: %v", fieldType)
		return types.JSON
	}
}

// fieldValFromRowVal converts a go-mysql-server row value to a data.field value
//
//nolint:gocyclo
func fieldValFromRowVal(fieldType data.FieldType, val interface{}) (interface{}, error) {
	// the input val may be nil, it also may not be a pointer even if the fieldtype is a nullable pointer type
	if val == nil {
		return nil, nil
	}

	switch fieldType {
	// ----------------------------
	// Int8 / Nullable Int8
	// ----------------------------
	case data.FieldTypeInt8:
		v, ok := val.(int8)
		if !ok {
			return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected int8", val, val)
		}
		return v, nil

	case data.FieldTypeNullableInt8:
		vP, ok := val.(*int8)
		if ok {
			return vP, nil
		}
		v, ok := val.(int8)
		if ok {
			return &v, nil
		}
		return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected int8 or *int8", val, val)

	// ----------------------------
	// Uint8 / Nullable Uint8
	// ----------------------------
	case data.FieldTypeUint8:
		v, ok := val.(uint8)
		if !ok {
			return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected uint8", val, val)
		}
		return v, nil

	case data.FieldTypeNullableUint8:
		vP, ok := val.(*uint8)
		if ok {
			return vP, nil
		}
		v, ok := val.(uint8)
		if ok {
			return &v, nil
		}
		return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected uint8 or *uint8", val, val)

	// ----------------------------
	// Int16 / Nullable Int16
	// ----------------------------
	case data.FieldTypeInt16:
		v, ok := val.(int16)
		if !ok {
			return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected int16", val, val)
		}
		return v, nil

	case data.FieldTypeNullableInt16:
		vP, ok := val.(*int16)
		if ok {
			return vP, nil
		}
		v, ok := val.(int16)
		if ok {
			return &v, nil
		}
		return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected int16 or *int16", val, val)

	// ----------------------------
	// Uint16 / Nullable Uint16
	// ----------------------------
	case data.FieldTypeUint16:
		v, ok := val.(uint16)
		if !ok {
			return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected uint16", val, val)
		}
		return v, nil

	case data.FieldTypeNullableUint16:
		vP, ok := val.(*uint16)
		if ok {
			return vP, nil
		}
		v, ok := val.(uint16)
		if ok {
			return &v, nil
		}
		return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected uint16 or *uint16", val, val)

	// ----------------------------
	// Int32 / Nullable Int32
	// ----------------------------
	case data.FieldTypeInt32:
		v, ok := val.(int32)
		if !ok {
			return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected int32", val, val)
		}
		return v, nil

	case data.FieldTypeNullableInt32:
		vP, ok := val.(*int32)
		if ok {
			return vP, nil
		}
		v, ok := val.(int32)
		if ok {
			return &v, nil
		}
		return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected int32 or *int32", val, val)

	// ----------------------------
	// Uint32 / Nullable Uint32
	// ----------------------------
	case data.FieldTypeUint32:
		v, ok := val.(uint32)
		if !ok {
			return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected uint32", val, val)
		}
		return v, nil

	case data.FieldTypeNullableUint32:
		vP, ok := val.(*uint32)
		if ok {
			return vP, nil
		}
		v, ok := val.(uint32)
		if ok {
			return &v, nil
		}
		return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected uint32 or *uint32", val, val)

	// ----------------------------
	// Int64 / Nullable Int64
	// ----------------------------
	case data.FieldTypeInt64:
		v, ok := val.(int64)
		if !ok {
			return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected int64", val, val)
		}
		return v, nil

	case data.FieldTypeNullableInt64:
		vP, ok := val.(*int64)
		if ok {
			return vP, nil
		}
		v, ok := val.(int64)
		if ok {
			return &v, nil
		}
		return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected int64 or *int64", val, val)

	// ----------------------------
	// Uint64 / Nullable Uint64
	// ----------------------------
	case data.FieldTypeUint64:
		v, ok := val.(uint64)
		if !ok {
			return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected uint64", val, val)
		}
		return v, nil

	case data.FieldTypeNullableUint64:
		vP, ok := val.(*uint64)
		if ok {
			return vP, nil
		}
		v, ok := val.(uint64)
		if ok {
			return &v, nil
		}
		return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected uint64 or *uint64", val, val)

	// ----------------------------
	// Float64 / Nullable Float64
	// ----------------------------
	case data.FieldTypeFloat64:
		// Accept float64 or decimal.Decimal, convert decimal.Decimal -> float64
		if v, ok := val.(float64); ok {
			return v, nil
		}
		if d, ok := val.(decimal.Decimal); ok {
			return d.InexactFloat64(), nil
		}
		return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected float64 or decimal.Decimal", val, val)

	case data.FieldTypeNullableFloat64:
		// Possibly already *float64
		if vP, ok := val.(*float64); ok {
			return vP, nil
		}
		// Possibly float64
		if v, ok := val.(float64); ok {
			return &v, nil
		}
		// Possibly decimal.Decimal
		if d, ok := val.(decimal.Decimal); ok {
			f := d.InexactFloat64()
			return &f, nil
		}
		return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected float64, *float64, or decimal.Decimal", val, val)

	// ----------------------------
	// Time / Nullable Time
	// ----------------------------
	case data.FieldTypeTime:
		v, ok := val.(time.Time)
		if !ok {
			return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected time.Time", val, val)
		}
		return v, nil

	case data.FieldTypeNullableTime:
		vP, ok := val.(*time.Time)
		if ok {
			return vP, nil
		}
		v, ok := val.(time.Time)
		if ok {
			return &v, nil
		}
		return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected time.Time or *time.Time", val, val)

	// ----------------------------
	// String / Nullable String
	// ----------------------------
	case data.FieldTypeString:
		v, ok := val.(string)
		if !ok {
			return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected string", val, val)
		}
		return v, nil

	case data.FieldTypeNullableString:
		vP, ok := val.(*string)
		if ok {
			return vP, nil
		}
		v, ok := val.(string)
		if ok {
			return &v, nil
		}
		return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected string or *string", val, val)

	// ----------------------------
	// Bool / Nullable Bool
	// ----------------------------
	case data.FieldTypeBool:
		v, ok := val.(bool)
		if !ok {
			return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected bool", val, val)
		}
		return v, nil

	case data.FieldTypeNullableBool:
		vP, ok := val.(*bool)
		if ok {
			return vP, nil
		}
		v, ok := val.(bool)
		if ok {
			return &v, nil
		}
		return nil, fmt.Errorf("unexpected value type for interface %v of type %T, expected bool or *bool", val, val)

	// ----------------------------
	// Fallback / Unsupported
	// ----------------------------
	default:
		return nil, fmt.Errorf("unsupported field type %s for val %v", fieldType, val)
	}
}

// Is the field nilAt the index. Can panic if out of range.
// TODO: Maybe this should be a method on data.Field?
func nilAt(field data.Field, at int) bool {
	if !field.Nullable() {
		return false
	}

	switch field.Type() {
	case data.FieldTypeNullableInt8:
		v := field.At(at).(*int8)
		return v == nil

	case data.FieldTypeNullableUint8:
		v := field.At(at).(*uint8)
		return v == nil

	case data.FieldTypeNullableInt16:
		v := field.At(at).(*int16)
		return v == nil

	case data.FieldTypeNullableUint16:
		v := field.At(at).(*uint16)
		return v == nil

	case data.FieldTypeNullableInt32:
		v := field.At(at).(*int32)
		return v == nil

	case data.FieldTypeNullableUint32:
		v := field.At(at).(*uint32)
		return v == nil

	case data.FieldTypeNullableInt64:
		v := field.At(at).(*int64)
		return v == nil

	case data.FieldTypeNullableUint64:
		v := field.At(at).(*uint64)
		return v == nil

	case data.FieldTypeNullableFloat64:
		v := field.At(at).(*float64)
		return v == nil

	case data.FieldTypeNullableString:
		v := field.At(at).(*string)
		return v == nil

	case data.FieldTypeNullableTime:
		v := field.At(at).(*time.Time)
		return v == nil

	case data.FieldTypeNullableBool:
		v := field.At(at).(*bool)
		return v == nil

	default:
		// Either it's not a nullable type or it's unsupported
		return false
	}
}
