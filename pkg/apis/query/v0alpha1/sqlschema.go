package v0alpha1

import (
	"encoding/json"
	"reflect"

	openapi "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// BasicColumn represents the column type for data that is input to a SQL expression.
type BasicColumn struct {
	Name               string         `json:"name"`
	MySQLType          string         `json:"mysqlType"`
	Nullable           bool           `json:"nullable"`
	DataFrameFieldType data.FieldType `json:"dataFrameFieldType"`
}

// SchemaInfo provides information and some sample data for data that could be an input
// to a SQL expression.
type SchemaInfo struct {
	Columns    []BasicColumn `json:"columns"`
	SampleRows SampleRows    `json:"sampleRows"`
	Error      string        `json:"error,omitempty"`
}

type SampleRows struct {
	Values [][]any
}

func (u *SampleRows) MarshalJSON() ([]byte, error) {
	return json.Marshal(u.Values)
}

func (u *SampleRows) UnmarshalJSON(data []byte) error {
	return json.Unmarshal(data, &u.Values)
}

// Produce an API definition that represents [][]any
func (u SampleRows) OpenAPIDefinition() openapi.OpenAPIDefinition {
	return openapi.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type:                 []string{"object"},
				AdditionalProperties: &spec.SchemaOrBool{Allows: true},
			},
			VendorExtensible: spec.VendorExtensible{
				Extensions: map[string]any{
					"x-kubernetes-preserve-unknown-fields": true,
				},
			},
		},
	}
}

// SQLSchemas returns info about what the Schema for a DS query will be like if the
// query were to be used an input to SQL expressions. So effectively post SQL expressions input
// conversion.
// There is a a manual DeepCopy at the end of this file that will need to be updated when this our the
// underlying structs are change. The hack script will also need to be run to update the Query service API
// generated types.
type SQLSchemas map[string]SchemaInfo

// DeepCopy returns a deep copy of the schema.
func (in *SampleRows) DeepCopy() *SampleRows {
	if in == nil {
		return nil
	}
	return &SampleRows{
		Values: deepCopySampleRows2D(in.Values),
	}
}

// Deep-copy [][]any preserving nil vs empty slices and cloning elements.
func deepCopySampleRows2D(in [][]any) [][]any {
	if in == nil {
		return nil
	}
	out := make([][]any, len(in))
	for i, row := range in {
		if row == nil {
			// preserve nil inner slice
			continue
		}
		newRow := make([]any, len(row))
		for j, v := range row {
			newRow[j] = deepCopyAny(v)
		}
		out[i] = newRow
	}
	return out
}

// Recursively clone pointers, maps, slices, arrays, and interfaces.
// Structs are copied by value (shallow for their internals).
func deepCopyAny(v any) any {
	if v == nil {
		return nil
	}
	return deepCopyRV(reflect.ValueOf(v)).Interface()
}

func deepCopyRV(rv reflect.Value) reflect.Value {
	if !rv.IsValid() {
		return rv
	}

	switch rv.Kind() {
	case reflect.Ptr:
		if rv.IsNil() {
			return rv
		}
		elemCopy := deepCopyRV(rv.Elem())
		newPtr := reflect.New(rv.Type().Elem())
		if elemCopy.Type().AssignableTo(newPtr.Elem().Type()) {
			newPtr.Elem().Set(elemCopy)
		} else if elemCopy.Type().ConvertibleTo(newPtr.Elem().Type()) {
			newPtr.Elem().Set(elemCopy.Convert(newPtr.Elem().Type()))
		} else {
			newPtr.Elem().Set(rv.Elem()) // fallback: shallow
		}
		return newPtr

	case reflect.Interface:
		if rv.IsNil() {
			return rv
		}
		return deepCopyRV(rv.Elem())

	case reflect.Map:
		if rv.IsNil() {
			return reflect.Zero(rv.Type())
		}
		newMap := reflect.MakeMapWithSize(rv.Type(), rv.Len())
		for _, k := range rv.MapKeys() {
			newMap.SetMapIndex(deepCopyRV(k), deepCopyRV(rv.MapIndex(k)))
		}
		return newMap

	case reflect.Slice:
		if rv.IsNil() {
			return reflect.Zero(rv.Type())
		}
		n := rv.Len()
		newSlice := reflect.MakeSlice(rv.Type(), n, n)
		for i := 0; i < n; i++ {
			newSlice.Index(i).Set(deepCopyRV(rv.Index(i)))
		}
		return newSlice

	case reflect.Array:
		n := rv.Len()
		newArr := reflect.New(rv.Type()).Elem()
		for i := 0; i < n; i++ {
			newArr.Index(i).Set(deepCopyRV(rv.Index(i)))
		}
		return newArr

	case reflect.Struct:
		// Value copy (OK unless the struct contains references you also want deep-copied).
		return rv

	default:
		// Scalars (string, bool, numbers), etc.
		return rv
	}
}
