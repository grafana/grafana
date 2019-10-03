package dataframe

import (
	"fmt"

	"github.com/apache/arrow/go/arrow"
	"github.com/apache/arrow/go/arrow/array"
	"github.com/apache/arrow/go/arrow/ipc"
	"github.com/apache/arrow/go/arrow/memory"
	"github.com/mattetti/filebuffer"
)

// toArrow converts the Frame to an arrow table and returns a byte
// representation of that table.
func toArrow(refID string, f *Frame) ([]byte, error) {
	arrowFields, err := buildArrowFields(f)
	if err != nil {
		return nil, err
	}

	schema, err := buildArrowSchema(refID, f, arrowFields)
	if err != nil {
		return nil, err
	}

	columns, err := buildArrowColumns(f, arrowFields)
	if err != nil {
		return nil, err
	}
	defer func(cols []array.Column) {
		for _, col := range cols {
			col.Release()
		}
	}(columns)

	// Create a table from the schema and columns.
	table := array.NewTable(schema, columns, -1)
	defer table.Release()

	tableReader := array.NewTableReader(table, -1)
	defer tableReader.Release()

	// Arrow tables with the Go API are written to files, so we create a fake
	// file buffer that the FileWriter can write to. In the future, and with
	// streaming, I think will likely be using the Arrow message type some how.
	fb := filebuffer.New(nil)

	fw, err := ipc.NewFileWriter(fb, ipc.WithSchema(tableReader.Schema()))
	if err != nil {
		return nil, err
	}

	for tableReader.Next() {
		rec := tableReader.Record()

		if err := fw.Write(rec); err != nil {
			rec.Release()
			return nil, err
		}
		rec.Release()
	}

	if err := fw.Close(); err != nil {
		return nil, err
	}

	return fb.Buff.Bytes(), nil
}

// buildArrowFields builds Arrow field definitions from a DataFrame.
func buildArrowFields(f *Frame) ([]arrow.Field, error) {
	arrowFields := make([]arrow.Field, len(f.Fields))

	for i, field := range f.Fields {
		t, err := fieldToArrow(field.Type)
		if err != nil {
			return nil, err
		}

		fieldMeta := map[string]string{
			"name": field.Name,
			"type": field.Type.String(),
		}

		arrowFields[i] = arrow.Field{
			Name:     field.Name,
			Type:     t,
			Metadata: arrow.MetadataFrom(fieldMeta),
			Nullable: true,
		}
	}

	return arrowFields, nil
}

// buildArrowColumns builds Arrow columns from a DataFrame.
func buildArrowColumns(f *Frame, arrowFields []arrow.Field) ([]array.Column, error) {
	pool := memory.NewGoAllocator()
	columns := make([]array.Column, len(f.Fields))

	for fieldIdx, field := range f.Fields {
		switch field.Type {
		case FieldTypeNumber:
			columns[fieldIdx] = *buildFloatColumn(pool, arrowFields[fieldIdx], field.Vector.(floatVector))
		case FieldTypeTime:
			columns[fieldIdx] = *buildTimeColumn(pool, arrowFields[fieldIdx], field.Vector.(timeVector))
		default:
			return nil, fmt.Errorf("unsupported field type: %s", field.Type)
		}
	}
	return columns, nil
}

func buildFloatColumn(pool memory.Allocator, field arrow.Field, vec floatVector) *array.Column {
	builder := array.NewFloat64Builder(pool)
	defer builder.Release()

	for _, v := range vec {
		//if v == nil {
		//	builder.AppendNull()
		//	continue
		//}
		builder.Append(v.Float())
	}

	chunked := array.NewChunked(field.Type, []array.Interface{builder.NewArray()})
	defer chunked.Release()

	return array.NewColumn(field, chunked)
}

func buildTimeColumn(pool memory.Allocator, field arrow.Field, vec timeVector) *array.Column {
	builder := array.NewTimestampBuilder(pool, &arrow.TimestampType{
		Unit: arrow.Nanosecond,
	})
	defer builder.Release()

	for _, v := range vec {
		//if v == nil {
		//	builder.AppendNull()
		//	continue
		//}
		builder.Append(arrow.Timestamp(v.Time().UnixNano()))
	}

	chunked := array.NewChunked(field.Type, []array.Interface{builder.NewArray()})
	defer chunked.Release()

	return array.NewColumn(field, chunked)
}

// buildArrowSchema builds an Arrow schema for a DataFrame.
func buildArrowSchema(refID string, f *Frame, fs []arrow.Field) (*arrow.Schema, error) {
	tableMetaMap := map[string]string{
		"name":  f.Name,
		"refId": refID,
	}

	if f.Labels != nil {
		tableMetaMap["labels"] = f.Labels.String()
	}

	tableMeta := arrow.MetadataFrom(tableMetaMap)

	return arrow.NewSchema(fs, &tableMeta), nil
}

// fieldToArrow returns the corresponding Arrow primitive type to the fields'
// Vector primitives.
func fieldToArrow(f FieldType) (arrow.DataType, error) {
	switch f {
	case FieldTypeString:
		return &arrow.StringType{}, nil
	case FieldTypeNumber:
		return &arrow.Float64Type{}, nil
	case FieldTypeTime:
		return &arrow.TimestampType{}, nil
	default:
		return nil, fmt.Errorf("unsupported type: %s", f)
	}
}
