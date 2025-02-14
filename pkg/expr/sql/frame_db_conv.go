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
			// Run val through mysql.Type.Convert to normalize underlying value
			// of the interface
			nV, _, err := schema[i].Type.Convert(val)
			if err != nil {
				return nil, err
			}

			// Run the normalized value through fieldValFromRowVal to normalize
			// the interface type to the dataframe value type, and make nullable
			// values pointers as dataframe expects.
			fV, err := fieldValFromRowVal(f.Fields[i].Type(), nV)
			if err != nil {
				return nil, fmt.Errorf("unexpected type for column %s: %w", schema[i].Name, err)
			}

			f.Fields[i].Append(fV)
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
	case types.Float32:
		fT = data.FieldTypeFloat32
	case types.Float64:
		fT = data.FieldTypeFloat64
	case types.Timestamp:
		fT = data.FieldTypeTime
	case types.Datetime:
		fT = data.FieldTypeTime
	case types.Boolean:
		fT = data.FieldTypeBool
	default:
		switch {
		case types.IsDecimal(col.Type):
			fT = data.FieldTypeFloat64
		case types.IsText(col.Type):
			fT = data.FieldTypeString
		default:
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
func fieldValFromRowVal(fieldType data.FieldType, val interface{}) (interface{}, error) {
	// if the input interface is nil, we can return an untyped nil
	if val == nil {
		return nil, nil
	}

	nullable := fieldType.Nullable()
	switch fieldType {
	case data.FieldTypeInt8, data.FieldTypeNullableInt8:
		v, ok := val.(int8)
		if ok {
			return ptrIfNull(v, nullable), nil
		}
		return nil, fmt.Errorf("unexpected value type %v of type %T, expected int8", val, val)

	case data.FieldTypeUint8, data.FieldTypeNullableUint8:
		v, ok := val.(uint8)
		if ok {
			return ptrIfNull(v, nullable), nil
		}
		return nil, fmt.Errorf("unexpected value type %v of type %T, expected uint8", val, val)

	case data.FieldTypeInt16, data.FieldTypeNullableInt16:
		v, ok := val.(int16)
		if ok {
			return ptrIfNull(v, nullable), nil
		}
		return nil, fmt.Errorf("unexpected value type %v of type %T, expected int16", val, val)

	case data.FieldTypeUint16, data.FieldTypeNullableUint16:
		v, ok := val.(uint16)
		if ok {
			return ptrIfNull(v, nullable), nil
		}
		return nil, fmt.Errorf("unexpected value type %v of type %T, expected uint16", val, val)

	case data.FieldTypeInt32, data.FieldTypeNullableInt32:
		v, ok := val.(int32)
		if ok {
			return ptrIfNull(v, nullable), nil
		}
		return nil, fmt.Errorf("unexpected value type %v of type %T, expected int32", val, val)

	case data.FieldTypeUint32, data.FieldTypeNullableUint32:
		v, ok := val.(uint32)
		if ok {
			return ptrIfNull(v, nullable), nil
		}
		return nil, fmt.Errorf("unexpected value type %v of type %T, expected uint32", val, val)

	case data.FieldTypeInt64, data.FieldTypeNullableInt64:
		v, ok := val.(int64)
		if ok {
			return ptrIfNull(v, nullable), nil
		}
		return nil, fmt.Errorf("unexpected value type %v of type %T, expected int64", val, val)

	case data.FieldTypeUint64, data.FieldTypeNullableUint64:
		v, ok := val.(uint64)
		if ok {
			return ptrIfNull(v, nullable), nil
		}
		return nil, fmt.Errorf("unexpected value type %v of type %T, expected uint64", val, val)

	case data.FieldTypeFloat32, data.FieldTypeNullableFloat32:
		v, ok := val.(float32)
		if ok {
			return ptrIfNull(v, nullable), nil
		}
		return nil, fmt.Errorf("unexpected value type %v of type %T, expected float32", val, val)

	case data.FieldTypeFloat64, data.FieldTypeNullableFloat64:
		if v, ok := val.(float64); ok {
			return ptrIfNull(v, nullable), nil
		}
		if vD, ok := val.(decimal.Decimal); ok {
			return ptrIfNull(vD.InexactFloat64(), nullable), nil
		}
		return nil, fmt.Errorf("unexpected value type %v of type %T, expected float64 or decimal.Decimal", val, val)

	case data.FieldTypeTime, data.FieldTypeNullableTime:
		v, ok := val.(time.Time)
		if ok {
			return ptrIfNull(v, nullable), nil
		}
		return nil, fmt.Errorf("unexpected value type %v of type %T, expected time.Time", val, val)

	case data.FieldTypeString, data.FieldTypeNullableString:
		v, ok := val.(string)
		if ok {
			return ptrIfNull(v, nullable), nil
		}
		return nil, fmt.Errorf("unexpected value type %v of type %T, expected string", val, val)

	case data.FieldTypeBool, data.FieldTypeNullableBool:
		v, ok := val.(int8)
		if ok {
			b := v != 0
			return ptrIfNull(b, nullable), nil
		}
		return nil, fmt.Errorf("unexpected value type %v of type %T, expected int8 (for bool)", val, val)

	default:
		return nil, fmt.Errorf("unsupported field type %s for val %v", fieldType, val)
	}
}

func ptrIfNull[T any](val T, isNullable bool) interface{} {
	if isNullable {
		return &val
	}
	return val
}
