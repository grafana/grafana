package utils

import "github.com/go-stack/stack"

// Stack is copied from grafana/pkg/infra/log
// TODO: maybe this should live in grafana-plugin-sdk-go?
func Stack(skip int) string {
	call := stack.Caller(skip)
	s := stack.Trace().TrimBelow(call).TrimRuntime()
	return s.String()
}
