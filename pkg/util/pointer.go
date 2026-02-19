package util

func Pointer[T any](v T) *T { return &v }

// PointerOrNil returns a pointer to v if v is non-zero, otherwise nil.
func PointerOrNil[T comparable](v T) *T {
	var zero T
	if v == zero {
		return nil
	}
	return &v
}
