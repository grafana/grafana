package utils

import (
	"context"
	"fmt"
	"net/http"
	"reflect"
	"time"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type TableColumns struct {
	Definition []metav1.TableColumnDefinition
	Reader     func(obj any) ([]interface{}, error)
}

type TableConvertor interface {
	ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error)
}

// Based on https://github.com/kubernetes/kubernetes/blob/master/staging/src/k8s.io/apiserver/pkg/registry/rest/table.go
type customTableConvertor struct {
	gr      schema.GroupResource
	columns TableColumns
}

func NewTableConverter(gr schema.GroupResource, columns TableColumns) TableConvertor {
	if columns.Reader == nil {
		columns = TableColumns{
			Definition: []metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Created At", Type: "date"},
			},
			Reader: func(obj any) ([]interface{}, error) {
				v, err := meta.Accessor(obj)
				if err == nil && v != nil {
					return []interface{}{
						v.GetName(),
						v.GetCreationTimestamp().UTC().Format(time.RFC3339),
					}, nil
				}

				r := reflect.ValueOf(obj).Elem()
				n := r.FieldByName("Name").String()
				if n != "" {
					return []interface{}{
						n,
						"",
					}, nil
				}

				return []interface{}{
					fmt.Sprintf("%v", obj),
					"",
				}, nil
			},
		}
	}

	// Replace the description on standard columns with the global values
	for idx, column := range columns.Definition {
		if column.Description == "" {
			switch column.Name {
			case "Name":
				columns.Definition[idx].Description = swaggerMetadataDescriptions["name"]
			case "Created At":
				columns.Definition[idx].Description = swaggerMetadataDescriptions["creationTimestamp"]
			}
		}
	}
	return customTableConvertor{
		gr:      gr,
		columns: columns,
	}
}

var _ TableConvertor = &customTableConvertor{}
var swaggerMetadataDescriptions = metav1.ObjectMeta{}.SwaggerDoc()

func (c customTableConvertor) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	table, ok := object.(*metav1.Table)
	if ok {
		return table, nil
	} else {
		table = &metav1.Table{}
	}
	fn := func(obj runtime.Object) error {
		cells, err := c.columns.Reader(obj)
		if err != nil {
			resource := c.gr
			return errNotAcceptable{resource: resource}
		}
		table.Rows = append(table.Rows, metav1.TableRow{
			Cells:  cells,
			Object: runtime.RawExtension{Object: obj},
		})
		return nil
	}
	switch {
	case meta.IsListType(object):
		if err := meta.EachListItem(object, fn); err != nil {
			return nil, err
		}
	default:
		if err := fn(object); err != nil {
			return nil, err
		}
	}
	if m, err := meta.ListAccessor(object); err == nil {
		table.ResourceVersion = m.GetResourceVersion()
		table.Continue = m.GetContinue()
		table.RemainingItemCount = m.GetRemainingItemCount()
	} else {
		if m, err := meta.CommonAccessor(object); err == nil {
			table.ResourceVersion = m.GetResourceVersion()
		}
	}
	if opt, ok := tableOptions.(*metav1.TableOptions); !ok || !opt.NoHeaders {
		table.ColumnDefinitions = c.columns.Definition
	}
	return table, nil
}

// errNotAcceptable indicates the resource doesn't support Table conversion
type errNotAcceptable struct {
	resource schema.GroupResource
}

func (e errNotAcceptable) Error() string {
	return fmt.Sprintf("the resource %s does not support being converted to a Table", e.resource)
}

func (e errNotAcceptable) Status() metav1.Status {
	return metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusNotAcceptable,
		Reason:  metav1.StatusReason("NotAcceptable"),
		Message: e.Error(),
	}
}
