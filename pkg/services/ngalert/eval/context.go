package eval

import (
	"context"

	"github.com/grafana/grafana/pkg/services/user"
)

// EvaluationContext represents the context in which a condition is evaluated.
type EvaluationContext struct {
	Ctx  context.Context
	User *user.SignedInUser
}

func NewContext(ctx context.Context, user *user.SignedInUser) EvaluationContext {
	return EvaluationContext{
		Ctx:  ctx,
		User: user,
	}
}
