// Package optional sets the pointer fields App SDK codegen emits for optional API fields.
package optional

import (
	"reflect"
	"slices"
	"strings"
)

// NonZero returns a pointer to v, or nil when v is the zero value. Optional fields used to
// be omitempty values, so leaving zero values unset keeps them out of the JSON.
func NonZero[T comparable](v T) *T {
	var zero T
	if v == zero {
		return nil
	}
	return &v
}

// ClearZero sets every omitempty pointer to a zero scalar in the struct obj points to to nil,
// recursing into nested structs and slices of structs. Optional spec and status fields are
// pointers, so without this a "", 0 or false would be stored and echoed back, where omitempty
// on the old value fields dropped it. Pointers without omitempty are nullable fields whose zero
// value is meaningful, such as a lastTransitionTime of "" that validation must still reject.
func ClearZero(obj any) {
	clearZero(reflect.ValueOf(obj).Elem())
}

func clearZero(v reflect.Value) {
	for i := 0; i < v.NumField(); i++ {
		f := v.Field(i)
		switch {
		case !f.CanSet():
		case f.Kind() == reflect.Slice:
			// Pointers to scalars in a slice are kept: nil would become a null list entry.
			for j := 0; j < f.Len(); j++ {
				clearZeroStruct(f.Index(j))
			}
		case f.Kind() == reflect.Pointer && !f.IsNil() && f.Elem().Kind() != reflect.Struct:
			if f.Elem().IsZero() && omitsEmpty(v.Type().Field(i)) {
				f.SetZero()
			}
		default:
			clearZeroStruct(f)
		}
	}
}

// clearZeroStruct recurses into v when it is a struct or a non-nil pointer to one.
func clearZeroStruct(v reflect.Value) {
	if v.Kind() == reflect.Pointer && !v.IsNil() {
		v = v.Elem()
	}
	if v.Kind() == reflect.Struct {
		clearZero(v)
	}
}

func omitsEmpty(f reflect.StructField) bool {
	_, opts, _ := strings.Cut(f.Tag.Get("json"), ",")
	return slices.Contains(strings.Split(opts, ","), "omitempty")
}
