//go:build !arm

package sql

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"strconv"
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

func SchemaFromFrame(frame *data.Frame) mysql.Schema {
	schema := make(mysql.Schema, len(frame.Fields))
	names := uniqueColumnNames(frame.Fields)

	for i, field := range frame.Fields {
		schema[i] = &mysql.Column{
			Name:     names[i],
			Type:     convertDataType(field.Type()),
			Nullable: field.Type().Nullable(),
			Source:   strings.ToLower(frame.RefID),
		}
	}

	return schema
}

// uniqueColumnNames returns the field names with repeats renamed to
// <name>_2, <name>_3, and so on. The engine matches column names
// case-insensitively and fails on an ambiguous name, so repeats are found
// case-insensitively. A suffix that another field already uses is skipped,
// so fields that are not repeats keep their names.
func uniqueColumnNames(fields []*data.Field) []string {
	taken := make(map[string]struct{}, len(fields))
	for _, field := range fields {
		taken[strings.ToLower(field.Name)] = struct{}{}
	}

	seen := make(map[string]struct{}, len(fields))
	names := make([]string, len(fields))
	for i, field := range fields {
		name := field.Name
		if _, ok := seen[strings.ToLower(name)]; ok {
			for n := 2; ; n++ {
				candidate := fmt.Sprintf("%s_%d", field.Name, n)
				if _, ok := taken[strings.ToLower(candidate)]; !ok {
					name = candidate
					break
				}
			}
			taken[strings.ToLower(name)] = struct{}{}
		}
		seen[strings.ToLower(name)] = struct{}{}
		names[i] = name
	}
	return names
}

// Schema implements the mysql.Table interface
func (ft *FrameTable) Schema() mysql.Schema {
	if ft.schema == nil {
		ft.schema = SchemaFromFrame(ft.Frame)
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
		switch v := val.(type) {
		case float32:
			if math.IsNaN(float64(v)) || math.IsInf(float64(v), 0) {
				continue
			}
		case float64:
			if math.IsNaN(v) || math.IsInf(v, 0) {
				continue
			}
		case data.EnumItemIndex:
			val = enumText(field, v)
		}

		// If the field is JSON, convert json.RawMessage to types.JSONDocument
		if raw, ok := val.(json.RawMessage); ok {
			// Invalid values read as NULL so queries like COUNT(*) keep working; QueryFrames warns about them.
			if !json.Valid(raw) {
				continue
			}
			doc, inRange, err := types.JSON.Convert(ctx, []byte(raw))
			if err != nil {
				return nil, fmt.Errorf("failed to convert json.RawMessage to JSONDocument: %w", err)
			}
			if inRange != mysql.InRange {
				return nil, fmt.Errorf("invalid JSON value detected at row %d, column %s: value required type coercion", ri.row, ri.ft.Frame.Fields[colIndex].Name)
			}
			val = doc
		}

		row[colIndex] = val
	}

	ri.row++
	return row, nil
}

// invalidJSONNotices returns one warning for each JSON column that has
// values that are not valid JSON, since rowIter reads those values as NULL.
// Empty and whitespace-only values also read as NULL, but get no warning.
func invalidJSONNotices(frames []*data.Frame) []data.Notice {
	var notices []data.Notice
	for _, frame := range frames {
		var names []string
		for colIndex, field := range frame.Fields {
			if t := field.Type(); t != data.FieldTypeJSON && t != data.FieldTypeNullableJSON { //nolint:staticcheck
				continue
			}
			count := 0
			for i := range field.Len() {
				if field.NilAt(i) {
					continue
				}
				val, _ := field.ConcreteAt(i)
				raw, ok := val.(json.RawMessage)
				if ok && len(bytes.TrimSpace(raw)) > 0 && !json.Valid(raw) {
					count++
				}
			}
			if count == 0 {
				continue
			}
			if names == nil {
				names = uniqueColumnNames(frame.Fields)
			}
			notices = append(notices, data.Notice{
				Severity: data.NoticeSeverityWarning,
				Text:     fmt.Sprintf("%s: column %s has values that are not valid JSON (%d of %d rows). They read as NULL.", frame.RefID, names[colIndex], count, field.Len()),
			})
		}
	}
	return notices
}

// enumText returns the display text for an enum index, or the index as text
// when the field has no enum config or the index is out of range.
func enumText(field *data.Field, idx data.EnumItemIndex) string {
	if field.Config != nil && field.Config.TypeConfig != nil && field.Config.TypeConfig.Enum != nil {
		if text := field.Config.TypeConfig.Enum.Text; int(idx) < len(text) {
			return text[idx]
		}
	}
	return strconv.Itoa(int(idx))
}

// SampleRow returns a copy of the row at rowIdx with values as SQL reads them,
// so schema samples match what queries see.
func SampleRow(frame *data.Frame, rowIdx int) []any {
	row := frame.RowCopy(rowIdx)
	for i, field := range frame.Fields {
		switch v := row[i].(type) {
		case data.EnumItemIndex:
			row[i] = enumText(field, v)
		case *data.EnumItemIndex:
			if v != nil {
				text := enumText(field, *v)
				row[i] = &text
			}
		}
	}
	return row
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
	case data.FieldTypeString, data.FieldTypeNullableString,
		data.FieldTypeEnum, data.FieldTypeNullableEnum:
		return types.Text
	case data.FieldTypeBool, data.FieldTypeNullableBool:
		return types.Boolean
	case data.FieldTypeTime, data.FieldTypeNullableTime:
		return types.Timestamp
	case data.FieldTypeJSON, data.FieldTypeNullableJSON: //nolint:staticcheck
		return types.JSON
	default:
		fmt.Printf("------- Unsupported field type: %v", fieldType)
		return types.JSON
	}
}
