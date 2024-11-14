package resource

import (
	"encoding/json"
	"fmt"
	"strconv"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// Convert the the protobuf model to k8s table format
func (x *ResourceTable) ToK8s(parseCells bool) (metav1.Table, error) {
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

	var err error
	columnCount := len(x.Columns)
	converter := make([]func(v []byte) (any, error), columnCount)
	table.ColumnDefinitions = make([]metav1.TableColumnDefinition, columnCount)
	for i, column := range x.Columns {
		table.ColumnDefinitions[i], converter[i] = column.ToK8s()
		if !parseCells && column.Type != ResourceTableColumnDefinition_STRING {
			converter[i] = func(v []byte) (any, error) {
				return json.RawMessage(v), nil
			} // keep it as JSON
		}
	}

	table.Rows = make([]metav1.TableRow, len(x.Rows))
	for i, r := range x.Rows {
		row := metav1.TableRow{
			Cells: make([]interface{}, len(r.Cells)),
		}
		if len(r.Cells) != columnCount {
			return table, fmt.Errorf("invalid cells size (have=%d, expect=%d)", len(r.Cells), columnCount)
		}

		for j, v := range r.Cells {
			row.Cells[j], err = converter[j](v)
			if err != nil {
				return table, fmt.Errorf("error converting (row=%d, column=%d) %w", i, j, err)
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

func (x *ResourceTable) AddRow(key *ResourceKey, rv int64, values []any, obj runtime.Object) error {
	row := &ResourceTableRow{
		Key:             key,
		ResourceVersion: rv,
	}
	if x.Columns != nil && len(x.Columns) != len(values) {
		return fmt.Errorf("wrong length")
	}
	err := row.SetCells(values)
	if err != nil {
		return err
	}

	if obj != nil {
		row.Object, err = json.Marshal(obj)
		if err != nil {
			return err
		}
	}

	// finally add the row
	x.Rows = append(x.Rows, row)
	return err
}

func (x *ResourceTableColumnDefinition) ToK8s() (metav1.TableColumnDefinition, func([]byte) (any, error)) {
	def := metav1.TableColumnDefinition{
		Name:        x.Name,
		Description: x.Description,
		Priority:    x.Priority,
	}
	converter := func(v []byte) (any, error) { return json.RawMessage(v), nil } // noop

	switch x.Type {
	case ResourceTableColumnDefinition_UNKNOWN_TYPE:
	case ResourceTableColumnDefinition_STRING:
		def.Type = "string"
		converter = func(v []byte) (any, error) {
			return string(v), nil
		}

	case ResourceTableColumnDefinition_BOOLEAN:
		def.Type = "boolean"
		converter = func(v []byte) (any, error) {
			if len(v) == 0 {
				return nil, nil
			}
			b := false
			err := json.Unmarshal(v, &b)
			return b, err
		}

	case ResourceTableColumnDefinition_INT32:
		def.Type = "number"
		def.Format = "int32"
		converter = func(v []byte) (any, error) {
			if len(v) == 0 {
				return nil, nil
			}
			b := int32(0)
			err := json.Unmarshal(v, &b)
			return b, err
		}

	case ResourceTableColumnDefinition_INT64:
		def.Type = "number"
		def.Format = "int64"
		converter = func(v []byte) (any, error) {
			if len(v) == 0 {
				return nil, nil
			}
			b := int64(0)
			err := json.Unmarshal(v, &b)
			return b, err
		}

	case ResourceTableColumnDefinition_DOUBLE:
		def.Type = "number"
		def.Format = "double"
		converter = func(v []byte) (any, error) {
			if len(v) == 0 {
				return nil, nil
			}
			b := float64(0)
			err := json.Unmarshal(v, &b)
			return b, err
		}

	case ResourceTableColumnDefinition_FLOAT:
		def.Type = "number"
		def.Format = "float"
		converter = func(v []byte) (any, error) {
			if len(v) == 0 {
				return nil, nil
			}
			b := float32(0)
			err := json.Unmarshal(v, &b)
			return b, err
		}

	case ResourceTableColumnDefinition_DATE:
		def.Type = "string"
		def.Format = "date"
		converter = func(v []byte) (any, error) {
			if len(v) == 0 {
				return nil, nil
			}
			b := metav1.Time{}
			err := json.Unmarshal(v, &b)
			return b, err
		}

	case ResourceTableColumnDefinition_DATE_TIME:
		def.Type = "string"
		def.Format = "date_time"
		converter = func(v []byte) (any, error) {
			if len(v) == 0 {
				return nil, nil
			}
			b := metav1.Time{}
			err := json.Unmarshal(v, &b)
			return b, err
		}

	case ResourceTableColumnDefinition_JSON:
		def.Type = "string"
		def.Format = "json"
		// default converter
	}

	return def, converter
}

func (x *ResourceTableRow) SetCells(values []any) (err error) {
	x.Cells = make([][]byte, len(values))
	for i, v := range values {
		if v == nil {
			continue
		}

		switch t := v.(type) {
		case string:
			x.Cells[i] = []byte(t)
		case json.RawMessage:
			x.Cells[i] = []byte(t)

		default:
			x.Cells[i], err = json.Marshal(v)
			if err != nil {
				return err
			}
		}
	}
	return err
}
