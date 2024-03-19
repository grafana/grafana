package util

func Pointer[T any](v T) *T { return &v }

func Depointerizer[T any](v *T) T {
	var emptyValue T
	if v != nil {
		emptyValue = *v
	}

	return emptyValue
}
