package eval

import (
	"context"

	"github.com/grafana/grafana/pkg/services/auth/identity"
)

// EvaluationContext represents the context in which a condition is evaluated.
type EvaluationContext struct {
	Ctx  context.Context
	User identity.Requester
}

func NewContext(ctx context.Context, user identity.Requester) EvaluationContext {
	return EvaluationContext{
		Ctx:  ctx,
		User: user,
	}
}
