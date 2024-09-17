package utils

import "github.com/go-stack/stack"

func Pointer[T any](arg T) *T { return &arg }

func Depointerizer[T any](v *T) T {
	var emptyValue T
	if v != nil {
		emptyValue = *v
	}

	return emptyValue
}

// Stack is copied from grafana/pkg/infra/log
// TODO: maybe this should live in grafana-plugin-sdk-go?
func Stack(skip int) string {
	call := stack.Caller(skip)
	s := stack.Trace().TrimBelow(call).TrimRuntime()
	return s.String()
}
