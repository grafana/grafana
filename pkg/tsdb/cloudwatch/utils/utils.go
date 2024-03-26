package utils

func Pointer[T any](arg T) *T { return &arg }

func Depointerizer[T any](v *T) T {
	var emptyValue T
	if v != nil {
		emptyValue = *v
	}

	return emptyValue
}
