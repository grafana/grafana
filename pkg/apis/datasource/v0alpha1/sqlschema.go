package v0alpha1

import (
	"encoding/json"
	"reflect"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	openapi "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// SQLSchemas returns info about what the Schema for a DS query will be like if the
// query were to be used an input to SQL expressions. So effectively post SQL expressions input
// conversion.
//
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryResponseSQLSchemas struct {
	metav1.TypeMeta `json:",inline"`

	// SchemaInfo for each requested query by refID
	SQLSchemas SQLSchemas `json:"sqlSchemas"`
}

func (QueryResponseSQLSchemas) OpenAPIModelName() string {
	return OpenAPIPrefix + "QueryResponseSQLSchemas"
}

type SQLSchemas = map[string]SchemaInfo

// BasicColumn represents the column type for data that is input to a SQL expression.
type BasicColumn struct {
	Name      string `json:"name"`
	MySQLType string `json:"mysqlType"`
	Nullable  bool   `json:"nullable"`

	// The DataFrameFieldType is the Grafana Plugin SDK data.FieldType that best represents this column
	// TODO: the OpenAPI thinks this is an integer, but data.FieldType is a uint8 alias.
	// we need to somehow expose this as a string value because the JSONMarshaler will write it as a string
	DataFrameFieldType data.FieldType `json:"dataFrameFieldType"`
}

func (BasicColumn) OpenAPIModelName() string {
	return OpenAPIPrefix + "BasicColumn"
}

// SchemaInfo provides information and some sample data for data that could be an input
// to a SQL expression.
type SchemaInfo struct {
	// +listType=atomic
	Columns    []BasicColumn `json:"columns"`
	SampleRows SampleRows    `json:"sampleRows"`
	Error      string        `json:"error,omitempty"`
}

func (SchemaInfo) OpenAPIModelName() string {
	return OpenAPIPrefix + "SchemaInfo"
}

// There is a a manual DeepCopy at the end of this file that will need to be updated when this our the
// underlying structs are change. The hack script will also need to be run to update the Query service API
// generated types.
type SampleRows struct {
	// +listType=atomic
	values [][]any
}

func (SampleRows) OpenAPIModelName() string {
	return OpenAPIPrefix + "SampleRows"
}

func NewSampleRows(values [][]any) SampleRows {
	return SampleRows{values: values}
}

func (u *SampleRows) Values() [][]any {
	return u.values
}

func (u SampleRows) MarshalJSON() ([]byte, error) {
	return json.Marshal(u.values)
}

func (u *SampleRows) UnmarshalJSON(data []byte) error {
	return json.Unmarshal(data, &u.values)
}

// Produce an API definition that represents [][]any
func (u SampleRows) OpenAPIDefinition() openapi.OpenAPIDefinition {
	return openapi.OpenAPIDefinition{
		Schema: *spec.ArrayProperty(spec.ArrayProperty( // Array of Array
			&spec.Schema{
				SchemaProps: spec.SchemaProps{ // no specific type for inner any
					AdditionalProperties: &spec.SchemaOrBool{Allows: true},
				},
			},
		)).WithDescription("[][]any"), // frontend says number | string | boolean | object
	}
}

// DeepCopy returns a deep copy of the SampleRows.
func (in *SampleRows) DeepCopy() *SampleRows {
	if in == nil {
		return nil
	}
	out := NewSampleRows(deepCopySampleRows2D(in.Values()))
	return &out
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
	case reflect.Pointer:
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
		newArr := reflect.New(rv.Type()).Elem()
		for i := range rv.Len() {
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
