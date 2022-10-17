package eval

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/services/user"
)

// EvaluationContext represents the context in which a condition is evaluated.
type EvaluationContext struct {
	Ctx  context.Context
	User *user.SignedInUser
	At   time.Time
}

func Context(ctx context.Context, user *user.SignedInUser) EvaluationContext {
	return EvaluationContext{
		Ctx:  ctx,
		User: user,
		At:   time.Now(),
	}
}

func (c EvaluationContext) WithTimeout(timeout time.Duration) (EvaluationContext, context.CancelFunc) {
	timeoutCtx, cancel := context.WithTimeout(c.Ctx, timeout)
	c.Ctx = timeoutCtx
	return c, cancel
}
