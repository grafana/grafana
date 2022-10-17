package eval

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/user"
)

// EvaluationContext represents the context in which a condition is evaluated.
type EvaluationContext struct {
	Ctx     context.Context
	User    *user.SignedInUser
	At      time.Time
	RuleUID string
}

func Context(ctx context.Context, user *user.SignedInUser) EvaluationContext {
	return EvaluationContext{
		Ctx:  ctx,
		User: user,
		At:   time.Now(),
	}
}

func (c EvaluationContext) When(t time.Time) EvaluationContext {
	c.At = t
	return c
}

func (c EvaluationContext) WithRule(r *models.AlertRule) EvaluationContext {
	if r != nil {
		c.RuleUID = r.UID
	}
	return c
}

func (c EvaluationContext) WithTimeout(timeout time.Duration) (EvaluationContext, context.CancelFunc) {
	timeoutCtx, cancel := context.WithTimeout(c.Ctx, timeout)
	c.Ctx = timeoutCtx
	return c, cancel
}
