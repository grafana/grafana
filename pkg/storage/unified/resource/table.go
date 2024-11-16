package resource

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	reflect "reflect"
	"strconv"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana-plugin-sdk-go/data/utils/jsoniter"
)

// Convert the the protobuf model into k8s (will decode each value)
func (x *ResourceTable) ToK8s() (metav1.Table, error) {
	table := metav1.Table{
		ListMeta: metav1.ListMeta{
			Continue: x.NextPageToken,
		},
	}
	if x.RemainingItemCount > 0 {
		table.RemainingItemCount = &x.RemainingItemCount
	}
	if x.ResourceVersion > 0 {
		table.ResourceVersion = strconv.FormatInt(x.ResourceVersion, 10)
	}

	columnCount := len(x.Columns)
	columns := make([]ResourceTableColumn, columnCount)
	table.ColumnDefinitions = make([]metav1.TableColumnDefinition, columnCount)
	for i, c := range x.Columns {
		columns[i] = *NewResourceTableColumn(c, i)
		table.ColumnDefinitions[i] = metav1.TableColumnDefinition{
			Name:        c.Name,
			Description: c.Description,
			Priority:    c.Priority,
			Type:        columns[i].OpenAPIType,
			Format:      columns[i].OpenAPIFormat,
		}
	}

	var err error
	table.Rows = make([]metav1.TableRow, len(x.Rows))
	for i, r := range x.Rows {
		row := metav1.TableRow{
			Cells: make([]interface{}, len(r.Cells)),
		}
		if len(r.Cells) != columnCount {
			return table, fmt.Errorf("invalid cells size (have=%d, expect=%d)", len(r.Cells), columnCount)
		}

		for j, v := range r.Cells {
			row.Cells[j], err = columns[j].Decode(v)
			if err != nil {
				return table, fmt.Errorf("error decoding (row=%d, column=%d) %w", i, j, err)
			}
		}

		// The raw object value
		if r.Object != nil {
			row.Object = runtime.RawExtension{
				Raw: r.Object,
			}
		} else if r.Key != nil {
			obj := &metav1.PartialObjectMetadata{
				ObjectMeta: metav1.ObjectMeta{
					Name:      r.Key.Name,
					Namespace: r.Key.Namespace,
				},
			}
			if r.ResourceVersion > 0 {
				obj.ResourceVersion = strconv.FormatInt(r.ResourceVersion, 10)
			}
			row.Object.Object = obj
			row.Object.Raw, err = json.Marshal(obj)
			if err != nil {
				return table, err
			}
		}
		table.Rows[i] = row
	}
	return table, err
}

type TableBuilder struct {
	ResourceTable

	lookup map[string]*ResourceTableColumn

	// Just keep track of it
	hasDuplicateNames bool

	// When add row gets a colum
	ignoreUnknownColumns bool
}

func NewTableBuilder(cols []*ResourceTableColumnDefinition) *TableBuilder {
	table := &TableBuilder{
		ResourceTable: ResourceTable{
			Columns: cols,
		},

		lookup: make(map[string]*ResourceTableColumn, len(cols)),

		// defaults
		ignoreUnknownColumns: false,
	}
	for i, v := range cols {
		if table.lookup[v.Name] != nil {
			table.hasDuplicateNames = true
			continue
		}
		table.lookup[v.Name] = NewResourceTableColumn(v, i)
	}
	return table
}

func (x *TableBuilder) AddRow(key *ResourceKey, rv int64, vals map[string]any) error {
	row := &ResourceTableRow{
		Key:             key,
		ResourceVersion: rv,
		Cells:           make([][]byte, len(x.Columns)),
	}

	for k, v := range vals {
		column, ok := x.lookup[k]
		if !ok {
			if x.ignoreUnknownColumns {
				continue
			}
			return fmt.Errorf("unknown column: " + k)
		}
		b, err := column.Encode(v)
		if err != nil {
			return err
		}
		row.Cells[column.index] = b
	}

	x.Rows = append(x.Rows, row)
	return nil
}

type ResourceTableColumn struct {
	def   *ResourceTableColumnDefinition
	index int

	reader func(iter *jsoniter.Iterator) (any, error)
	writer func(v any, stream *jsoniter.Stream) error

	OpenAPIType   string
	OpenAPIFormat string
}

func NewResourceTableColumn(def *ResourceTableColumnDefinition, index int) *ResourceTableColumn {
	col := &ResourceTableColumn{def: def, index: index}

	// Initially ignore the array property, we wil wrap that at the end
	switch def.Type {
	case ResourceTableColumnDefinition_UNKNOWN_TYPE: // left as null
	case ResourceTableColumnDefinition_STRING:
		col.OpenAPIType = "string"
		col.reader = func(iter *jsoniter.Iterator) (any, error) {
			return iter.ReadString()
		}

	case ResourceTableColumnDefinition_BOOLEAN:
		col.OpenAPIType = "boolean"
		col.reader = func(iter *jsoniter.Iterator) (any, error) {
			return iter.ReadBool()
		}

	case ResourceTableColumnDefinition_INT32:
		col.OpenAPIType = "number"
		col.OpenAPIFormat = "int32"
		col.reader = func(iter *jsoniter.Iterator) (any, error) {
			return iter.ReadInt32()
		}

	case ResourceTableColumnDefinition_INT64:
		col.OpenAPIType = "number"
		col.OpenAPIFormat = "int64"
		col.reader = func(iter *jsoniter.Iterator) (any, error) {
			return iter.ReadInt64()
		}

	case ResourceTableColumnDefinition_DOUBLE:
		col.OpenAPIType = "number"
		col.OpenAPIFormat = "double"
		col.reader = func(iter *jsoniter.Iterator) (any, error) {
			return iter.ReadFloat64()
		}

	case ResourceTableColumnDefinition_FLOAT:
		col.OpenAPIType = "number"
		col.OpenAPIFormat = "float"
		col.reader = func(iter *jsoniter.Iterator) (any, error) {
			return iter.ReadFloat32()
		}

	// Encode everything we can -- the lower conversion can happen later?
	case ResourceTableColumnDefinition_DATE, ResourceTableColumnDefinition_DATE_TIME:
		col.OpenAPIType = "string"
		col.OpenAPIFormat = "date"
		if def.Type == ResourceTableColumnDefinition_DATE_TIME {
			col.OpenAPIFormat = "date_time"
		}
		col.writer = func(v any, stream *jsoniter.Stream) error {
			var t time.Time

			switch typed := v.(type) {
			case time.Time:
				t = typed
			case *time.Time:
				t = *typed
			case int64:
				t = time.UnixMilli(typed)
			default:
				return fmt.Errorf("unsupported date conversion (%t)", v)
			}

			// encode as millis has fastest parsing
			stream.WriteInt64(t.UnixMilli())
			return stream.Error
		}
		col.reader = func(iter *jsoniter.Iterator) (any, error) {
			nxt, err := iter.WhatIsNext()
			if err != nil {
				return nil, err
			}
			switch nxt {
			case jsoniter.NumberValue:
				ts, err := iter.ReadInt64()
				if err != nil {
					return nil, err
				}
				return time.UnixMilli(ts).UTC(), nil
				// TODOcase jsoniter.StringValue:
			}
			return nil, fmt.Errorf("unexpected: %+v", nxt)
		}

	case ResourceTableColumnDefinition_JSON:
		col.OpenAPIType = "string"
		col.OpenAPIFormat = "json"

		col.reader = func(iter *jsoniter.Iterator) (any, error) {
			return iter.Read()
		}
	}

	return col
}

func (x *ResourceTableColumn) Encode(v any) ([]byte, error) {
	if v == nil {
		return nil, nil // no types to write
	}

	// Arrays always need JSON wrappers
	if !x.def.IsArray {
		// But simple string can be raw bytes
		if x.def.Type == ResourceTableColumnDefinition_STRING {
			s, ok := v.(string)
			if !ok {
				return nil, fmt.Errorf("expecting a string field")
			}
			return []byte(s), nil
		}
		if x.def.Type == ResourceTableColumnDefinition_BINARY {
			s, ok := v.([]byte)
			if !ok {
				return nil, fmt.Errorf("expecting a byte array")
			}
			return s, nil
		}
	}

	buff := bytes.NewBuffer(make([]byte, 0, 128))
	cfg := jsoniter.ConfigCompatibleWithStandardLibrary
	stream := cfg.BorrowStream(buff)
	defer cfg.ReturnStream(stream)
	var err error

	writer := func(v any) error {
		if v == nil {
			stream.WriteNil() // only happens in an array
		} else if x.writer != nil {
			return x.writer(v, stream)
		} else {
			stream.WriteVal(v)
		}
		return stream.Error
	}

	if x.def.IsArray {
		stream.WriteArrayStart()

		switch reflect.TypeOf(v).Kind() {
		case reflect.Slice, reflect.Array:
			s := reflect.ValueOf(v)
			for i := 0; i < s.Len(); i++ {
				if i > 0 {
					stream.WriteMore()
				}
				sub := s.Index(i).Interface()
				err = writer(sub)
				if err != nil {
					return nil, err
				}
			}
		default:
			// single value? just write it and we will see?
			err = writer(v)
			if err != nil {
				return nil, err
			}
		}

		stream.WriteArrayEnd()
	} else {
		err = writer(v)
	}
	if err != nil {
		return nil, err
	}
	if stream.Error != nil {
		return nil, stream.Error
	}

	err = stream.Flush()
	if err != nil {
		return nil, err
	}
	return json.RawMessage(buff.Bytes()), nil
}

func (x *ResourceTableColumn) Decode(buff []byte) (any, error) {
	if len(buff) == 0 {
		return nil, nil
	}

	if !x.def.IsArray {
		if x.def.Type == ResourceTableColumnDefinition_STRING {
			return string(buff), nil
		}
		if x.def.Type == ResourceTableColumnDefinition_BINARY {
			return buff, nil
		}
	}

	iter, err := jsoniter.ParseBytes(jsoniter.ConfigDefault, buff)
	if err != nil {
		return nil, err
	}

	if x.def.IsArray {
		vals := []any{} // it may have nulls

		for more, err := iter.ReadArray(); more; more, err = iter.ReadArray() {
			if err != nil {
				return nil, err
			}
			v, err := x.reader(iter)
			if err == io.EOF {
				err = nil
			} else if err != nil {
				return nil, err
			}
			vals = append(vals, v)
		}

		return vals, iter.ReadError()
	}

	v, err := x.reader(iter)
	if err == io.EOF {
		err = nil
	} else if err != nil {
		return nil, err
	}
	return v, err
}
