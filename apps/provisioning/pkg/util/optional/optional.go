// Package optional sets the pointer fields App SDK codegen emits for optional API fields.
package optional

// NonZero returns a pointer to v, or nil when v is the zero value. Optional fields used to
// be omitempty values, so leaving zero values unset keeps them out of the JSON.
func NonZero[T comparable](v T) *T {
	var zero T
	if v == zero {
		return nil
	}
	return &v
}
