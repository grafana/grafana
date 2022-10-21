package eval

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/user"
)

// EvaluationContext represents the context in which a condition is evaluated.
type EvaluationContext struct {
	Ctx     context.Context
	User    *user.SignedInUser
	RuleUID string
}

func Context(ctx context.Context, user *user.SignedInUser) EvaluationContext {
	return EvaluationContext{
		Ctx:  ctx,
		User: user,
	}
}

func (c EvaluationContext) WithRule(r *models.AlertRule) EvaluationContext {
	if r != nil {
		c.RuleUID = r.UID
	}
	return c
}
