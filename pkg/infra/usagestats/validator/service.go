package validator

import "context"

type Service interface {
	ShouldBeReported(context.Context, string) bool
}
