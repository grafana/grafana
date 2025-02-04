package resource

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"os"
	reflect "reflect"
	"strconv"
	"testing"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

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
	columns := make([]resourceTableColumn, columnCount)
	table.ColumnDefinitions = make([]metav1.TableColumnDefinition, columnCount)
	for i, c := range x.Columns {
		col, err := newResourceTableColumn(c, i)
		if err != nil {
			return table, err
		}
		columns[i] = *col
		table.ColumnDefinitions[i] = metav1.TableColumnDefinition{
			Name:        c.Name,
			Description: c.Description,
			Priority:    c.Priority,
			Type:        col.OpenAPIType,
			Format:      col.OpenAPIFormat,
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
				col := columns[j]
				return table, fmt.Errorf("error decoding (row=%d, column=%d, type=%s) %w", i, j, col.def.Type.String(), err)
			}
		}

		// The raw object value
		if r.Object != nil {
			row.Object = runtime.RawExtension{
				Raw: r.Object,
			}
		} else if r.Key != nil {
			obj := &metav1.PartialObjectMetadata{
				TypeMeta: metav1.TypeMeta{
					Kind:       r.Key.Resource, // :(
					APIVersion: r.Key.Group,    // :(
				},
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

	lookup map[string]*resourceTableColumn

	// Just keep track of it
	hasDuplicateNames bool
}

type ResourceColumnEncoder = func(v any) ([]byte, error)

func NewTableBuilder(cols []*ResourceTableColumnDefinition) (*TableBuilder, error) {
	table := &TableBuilder{
		ResourceTable: ResourceTable{
			Columns: cols,
		},

		lookup: make(map[string]*resourceTableColumn, len(cols)),
	}
	var err error
	for i, v := range cols {
		if v == nil {
			return nil, fmt.Errorf("invalid field definitions")
		}
		if table.lookup[v.Name] != nil {
			table.hasDuplicateNames = true
			continue
		}
		table.lookup[v.Name], err = newResourceTableColumn(v, i)
		if err != nil {
			return nil, err
		}
	}
	return table, err
}

func (x *TableBuilder) Encoders() []ResourceColumnEncoder {
	encoders := make([]ResourceColumnEncoder, len(x.Columns))
	for i, f := range x.Columns {
		v := x.lookup[f.Name]
		encoders[i] = v.Encode
	}
	return encoders
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
			return fmt.Errorf("unknown column: %s", k)
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

type resourceTableColumn struct {
	def   *ResourceTableColumnDefinition
	index int

	// Used for array indexing
	reader func(iter *jsoniter.Iterator) (any, error)
	writer func(v any, stream *jsoniter.Stream) error

	OpenAPIType   string
	OpenAPIFormat string
}

// helper to decode a cell value
func DecodeCell(columnDef *ResourceTableColumnDefinition, index int, cellVal []byte) (any, error) {
	col, err := newResourceTableColumn(columnDef, index)
	if err != nil {
		return nil, err
	}
	res, err := col.Decode(cellVal)
	if err != nil {
		return nil, err
	}
	return res, nil
}

// nolint:gocyclo
func newResourceTableColumn(def *ResourceTableColumnDefinition, index int) (*resourceTableColumn, error) {
	col := &resourceTableColumn{def: def, index: index}

	// Initially ignore the array property, we wil wrap that at the end
	switch def.Type {
	case ResourceTableColumnDefinition_UNKNOWN_TYPE:
		return nil, fmt.Errorf("unknown column type")

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

			default:
				return nil, fmt.Errorf("unexpected JSON for date: %+v", nxt)
			}
		}

	case ResourceTableColumnDefinition_BINARY:
		col.OpenAPIType = "binary"
		col.writer = func(v any, stream *jsoniter.Stream) error {
			b, ok := v.([]byte)
			if !ok {
				return fmt.Errorf("unexpected binary type, found: %t", v)
			}
			str := base64.StdEncoding.EncodeToString(b)
			stream.WriteString(str)
			return stream.Error
		}
		col.reader = func(iter *jsoniter.Iterator) (any, error) {
			str, err := iter.ReadString()
			if err != nil {
				return nil, err
			}
			return base64.StdEncoding.DecodeString(str)
		}

	case ResourceTableColumnDefinition_OBJECT:
		col.OpenAPIType = "string"
		col.OpenAPIFormat = "json"

		col.reader = func(iter *jsoniter.Iterator) (any, error) {
			return iter.Read()
		}
	}

	return col, nil
}

func (x *resourceTableColumn) IsNotNil() bool {
	if x.def.Properties != nil {
		return x.def.Properties.NotNull
	}
	return false
}

// nolint:gocyclo
func (x *resourceTableColumn) Encode(v any) ([]byte, error) {
	if v == nil {
		if x.IsNotNil() {
			return nil, fmt.Errorf("expecting non-null value")
		}
		return nil, nil // no types to write
	}

	// Arrays will always use JSON formatting
	if !x.def.IsArray {
		switch x.def.Type {
		case ResourceTableColumnDefinition_STRING:
			{
				s, ok := v.(string)
				if !ok {
					return nil, fmt.Errorf("expecting a string field")
				}
				return []byte(s), nil
			}
		case ResourceTableColumnDefinition_BINARY:
			{
				s, ok := v.([]byte)
				if !ok {
					return nil, fmt.Errorf("expecting a byte array")
				}
				return s, nil
			}
		case ResourceTableColumnDefinition_BOOLEAN:
			{
				b, ok := v.(bool)
				if !ok {
					switch typed := v.(type) {
					case *bool:
						b = *typed
					case int:
						b = typed != 0
					case int32:
						b = typed != 0
					case int64:
						b = typed != 0
					default:
						return nil, fmt.Errorf("unexpected input for double field: %t", v)
					}
				}
				if b {
					return []byte{1}, nil
				}
				return []byte{0}, nil
			}
		case ResourceTableColumnDefinition_DATE_TIME, ResourceTableColumnDefinition_DATE:
			{
				f, ok := v.(time.Time)
				if !ok {
					switch typed := v.(type) {
					case *time.Time:
						f = *typed
					case metav1.Time:
						f = typed.Time
					case *metav1.Time:
						f = typed.Time
					case int64:
						f = time.UnixMilli(typed)
					default:
						return nil, fmt.Errorf("unexpected input for time field: %t", v)
					}
				}
				ts := f.UnixMilli()
				var buf bytes.Buffer
				err := binary.Write(&buf, binary.BigEndian, ts)
				return buf.Bytes(), err
			}
		case ResourceTableColumnDefinition_DOUBLE:
			{
				f, ok := v.(float64)
				if !ok {
					switch typed := v.(type) {
					case int:
						f = float64(typed)
					case int64:
						f = float64(typed)
					case float32:
						f = float64(typed)
					case uint64:
						f = float64(typed)
					case uint:
						f = float64(typed)
					default:
						return nil, fmt.Errorf("unexpected input for double field: %t", v)
					}
				}
				var buf bytes.Buffer
				err := binary.Write(&buf, binary.BigEndian, f)
				return buf.Bytes(), err
			}
		case ResourceTableColumnDefinition_INT64:
			{
				f, ok := v.(int64)
				if !ok {
					switch typed := v.(type) {
					case int:
						f = int64(typed)
					case int32:
						f = int64(typed)
					case float32:
						f = int64(typed)
					case float64:
						f = int64(typed)
					case uint64:
						f = int64(typed)
					case uint:
						f = int64(typed)
					default:
						return nil, fmt.Errorf("unexpected input for int64 field: %t", v)
					}
				}
				var buf bytes.Buffer
				err := binary.Write(&buf, binary.BigEndian, f)
				return buf.Bytes(), err
			}
		default:
			// use JSON encoding below
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

// nolint:gocyclo
func (x *resourceTableColumn) Decode(buff []byte) (any, error) {
	if len(buff) == 0 {
		return nil, nil
	}
	if !x.def.IsArray {
		switch x.def.Type {
		case ResourceTableColumnDefinition_STRING:
			return string(buff), nil
		case ResourceTableColumnDefinition_BINARY:
			return buff, nil
		case ResourceTableColumnDefinition_BOOLEAN:
			if len(buff) == 1 {
				return buff[0] != 0, nil
			}
		case ResourceTableColumnDefinition_DOUBLE:
			{
				var f float64
				count, err := binary.Decode(buff, binary.BigEndian, &f)
				if count == 8 && err == nil {
					return f, nil
				}
			}
		case ResourceTableColumnDefinition_INT64:
			{
				var f int64
				count, err := binary.Decode(buff, binary.BigEndian, &f)
				if count == 8 && err == nil {
					return f, nil
				}
			}
		case ResourceTableColumnDefinition_DATE_TIME, ResourceTableColumnDefinition_DATE:
			{
				var f int64
				count, err := binary.Decode(buff, binary.BigEndian, &f)
				if count == 8 && err == nil {
					return time.UnixMilli(f).UTC(), nil
				}
			}
		default:
			// use JSON decoding below
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
			//nolint:errorlint
			if err != nil && err != io.EOF { // EOF is normal when jsoniter is done
				return nil, err
			}
			vals = append(vals, v)
		}

		return vals, iter.ReadError()
	}

	v, err := x.reader(iter)
	//nolint:errorlint
	if err == io.EOF {
		err = nil
	} else if err != nil {
		return nil, err
	}
	return v, err
}

// AssertTableSnapshot will match a ResourceTable vs the saved value
func AssertTableSnapshot(t *testing.T, path string, table *ResourceTable) {
	t.Helper()

	k8sTable, err := table.ToK8s()
	require.NoError(t, err, "unable to create table response", path)
	actual, err := json.MarshalIndent(k8sTable, "", "  ")
	require.NoError(t, err, "unable to write table json", path)

	// Safe to disable, this is a test.
	// nolint:gosec
	expected, err := os.ReadFile(path)
	if err != nil || len(expected) < 1 {
		assert.Fail(t, "missing file: %s", path)
	} else if assert.JSONEq(t, string(expected), string(actual)) {
		return // everything is OK
	}

	// Write the snapshot
	// Safe to disable, this is a test.
	// nolint:gosec
	err = os.WriteFile(path, actual, 0600)
	require.NoError(t, err)
	fmt.Printf("Updated table snapshot: %s\n", path)
}
