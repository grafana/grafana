//go:build !arm

package sql

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"

	mysql "github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// FrameTable fulfills the mysql.Table interface for a data.Frame.
type FrameTable struct {
	Frame  *data.Frame
	schema mysql.Schema
}

// Name implements the sql.Nameable interface
func (ft *FrameTable) Name() string {
	return ft.Frame.RefID
}

// String implements the fmt.Stringer interface
func (ft *FrameTable) String() string {
	return ft.Name()
}

func schemaFromFrame(frame *data.Frame) mysql.Schema {
	schema := make(mysql.Schema, len(frame.Fields))

	for i, field := range frame.Fields {
		schema[i] = &mysql.Column{
			Name:     field.Name,
			Type:     convertDataType(field.Type()),
			Nullable: field.Type().Nullable(),
			Source:   strings.ToLower(frame.RefID),
		}
	}

	return schema
}

// Schema implements the mysql.Table interface
func (ft *FrameTable) Schema() mysql.Schema {
	if ft.schema == nil {
		ft.schema = schemaFromFrame(ft.Frame)
	}
	return ft.schema
}

// Collation implements the mysql.Table interface
func (ft *FrameTable) Collation() mysql.CollationID {
	return mysql.Collation_Unspecified
}

// Partitions implements the mysql.Table interface
func (ft *FrameTable) Partitions(ctx *mysql.Context) (mysql.PartitionIter, error) {
	return &noopPartitionIter{}, nil
}

// PartitionRows implements the mysql.Table interface
func (ft *FrameTable) PartitionRows(ctx *mysql.Context, _ mysql.Partition) (mysql.RowIter, error) {
	return &rowIter{ft: ft, row: 0}, nil
}

type rowIter struct {
	ft  *FrameTable
	row int
}

func (ri *rowIter) Next(ctx *mysql.Context) (mysql.Row, error) {
	// We assume each field in the Frame has the same number of rows.
	numRows := 0
	if len(ri.ft.Frame.Fields) > 0 {
		numRows = ri.ft.Frame.Fields[0].Len()
	}

	// If we've already exhausted all rows, return EOF
	if ri.row >= numRows {
		return nil, io.EOF
	}

	// Construct a Row (which is []interface{} under the hood) by pulling
	// the value from each column at the current row index.
	row := make(mysql.Row, len(ri.ft.Frame.Fields))
	for colIndex, field := range ri.ft.Frame.Fields {
		if field.NilAt(ri.row) {
			continue
		}
		val, _ := field.ConcreteAt(ri.row)

		// If the field is JSON, convert json.RawMessage to types.JSONDocument
		if raw, ok := val.(json.RawMessage); ok {
			doc, inRange, err := types.JSON.Convert(ctx, raw)
			if err != nil {
				return nil, fmt.Errorf("failed to convert json.RawMessage to JSONDocument: %w", err)
			}
			if !inRange {
				return nil, fmt.Errorf("invalid JSON value detected at row %d, column %s: value required type coercion", ri.row, ri.ft.Frame.Fields[colIndex].Name)
			}
			val = doc
		}

		row[colIndex] = val
	}

	ri.row++
	return row, nil
}

// Close implements the mysql.RowIter interface.
// In this no-op example, there isn't anything to do here.
func (ri *rowIter) Close(*mysql.Context) error {
	return nil
}

type noopPartitionIter struct {
	done bool
}

func (i *noopPartitionIter) Next(*mysql.Context) (mysql.Partition, error) {
	if !i.done {
		i.done = true
		return noopParition, nil
	}
	return nil, io.EOF
}

func (i *noopPartitionIter) Close(*mysql.Context) error {
	return nil
}

var noopParition = partition(nil)

type partition []byte

func (p partition) Key() []byte {
	return p
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
	case data.FieldTypeJSON, data.FieldTypeNullableJSON:
		return types.JSON
	default:
		fmt.Printf("------- Unsupported field type: %v", fieldType)
		return types.JSON
	}
}
