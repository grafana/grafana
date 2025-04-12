//go:build !arm

package sql

import (
	"encoding/json"
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
			nV, _, err := schema[i].Type.Convert(ctx, val)
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
	case types.JSON:
		fT = data.FieldTypeJSON
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

// fieldValFromRowVal converts a go-mysql-server row value to a data.field value
func fieldValFromRowVal(fieldType data.FieldType, val interface{}) (interface{}, error) {
	// if the input interface is nil, we can return an untyped nil
	if val == nil {
		return nil, nil
	}

	nullable := fieldType.Nullable()

	switch fieldType {
	case data.FieldTypeInt8, data.FieldTypeNullableInt8:
		return parseVal[int8](val, "int8", nullable)

	case data.FieldTypeUint8, data.FieldTypeNullableUint8:
		return parseVal[uint8](val, "uint8", nullable)

	case data.FieldTypeInt16, data.FieldTypeNullableInt16:
		return parseVal[int16](val, "int16", nullable)

	case data.FieldTypeUint16, data.FieldTypeNullableUint16:
		return parseVal[uint16](val, "uint16", nullable)

	case data.FieldTypeInt32, data.FieldTypeNullableInt32:
		return parseVal[int32](val, "int32", nullable)

	case data.FieldTypeUint32, data.FieldTypeNullableUint32:
		return parseVal[uint32](val, "uint32", nullable)

	case data.FieldTypeInt64, data.FieldTypeNullableInt64:
		return parseVal[int64](val, "int64", nullable)

	case data.FieldTypeUint64, data.FieldTypeNullableUint64:
		return parseVal[uint64](val, "uint64", nullable)

	case data.FieldTypeFloat32, data.FieldTypeNullableFloat32:
		return parseVal[float32](val, "float32", nullable)

	case data.FieldTypeFloat64, data.FieldTypeNullableFloat64:
		return parseFloat64OrDecimal(val, nullable)

	case data.FieldTypeTime, data.FieldTypeNullableTime:
		return parseVal[time.Time](val, "time.Time", nullable)

	case data.FieldTypeString, data.FieldTypeNullableString:
		return parseVal[string](val, "string", nullable)

	case data.FieldTypeBool, data.FieldTypeNullableBool:
		return parseBoolFromInt8(val, nullable)

	case data.FieldTypeJSON, data.FieldTypeNullableJSON:
		switch v := val.(type) {
		case types.JSONDocument:
			raw := json.RawMessage(v.String())
			if nullable {
				return &raw, nil
			}
			return raw, nil

		default:
			return nil, fmt.Errorf("JSON field does not support val %v of type %T", val, val)
		}

	default:
		return nil, fmt.Errorf("unsupported field type %s for val %v of type %T", fieldType, val, val)
	}
}

// parseVal attempts to assert `val` as type T. If successful, it returns either
// the value or a pointer, depending on `isNullable`. If not, returns an error.
func parseVal[T any](val interface{}, typeName string, isNullable bool) (interface{}, error) {
	v, ok := val.(T)
	if !ok {
		return nil, fmt.Errorf("unexpected value type %v of type %T, expected %s", val, val, typeName)
	}
	return ptrIfNull(v, isNullable), nil
}

// parseFloat64OrDecimal handles the special case where val can be float64 or decimal.Decimal.
func parseFloat64OrDecimal(val interface{}, isNullable bool) (interface{}, error) {
	if fv, ok := val.(float64); ok {
		return ptrIfNull(fv, isNullable), nil
	}
	if d, ok := val.(decimal.Decimal); ok {
		return ptrIfNull(d.InexactFloat64(), isNullable), nil
	}
	return nil, fmt.Errorf("unexpected value type %v of type %T, expected float64 or decimal.Decimal", val, val)
}

// parseBoolFromInt8 asserts val as an int8, converts non-zero to true.
// Returns pointer if isNullable, otherwise the bool value.
func parseBoolFromInt8(val interface{}, isNullable bool) (interface{}, error) {
	v, ok := val.(int8)
	if !ok {
		return nil, fmt.Errorf("unexpected value type %v of type %T, expected int8 (for bool)", val, val)
	}
	b := (v != 0)
	return ptrIfNull(b, isNullable), nil
}

// ptrIfNull returns a pointer to val if isNullable is true; otherwise, returns val.
func ptrIfNull[T any](val T, isNullable bool) interface{} {
	if isNullable {
		return &val
	}
	return val
}
