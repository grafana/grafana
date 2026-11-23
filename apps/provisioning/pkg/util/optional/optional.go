// Package optional sets the pointer fields App SDK codegen emits for optional API fields.
package optional

import "reflect"

// NonZero returns a pointer to v, or nil when v is the zero value. Optional fields used to
// be omitempty values, so leaving zero values unset keeps them out of the JSON.
func NonZero[T comparable](v T) *T {
	var zero T
	if v == zero {
		return nil
	}
	return &v
}

// ClearZero sets every pointer to a zero scalar in the struct obj points to to nil, recursing
// into nested structs. Optional spec and status fields are pointers, so without this a "", 0 or
// false would be stored and echoed back, where omitempty on the old value fields dropped it.
func ClearZero(obj any) {
	clearZero(reflect.ValueOf(obj).Elem())
}

func clearZero(v reflect.Value) {
	for i := 0; i < v.NumField(); i++ {
		f := v.Field(i)
		switch {
		case !f.CanSet():
		case f.Kind() == reflect.Struct:
			clearZero(f)
		case f.Kind() != reflect.Pointer || f.IsNil():
		case f.Elem().Kind() == reflect.Struct:
			clearZero(f.Elem())
		case f.Elem().IsZero():
			f.SetZero()
		}
	}
}
