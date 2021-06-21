package evaluator

import (
	"context"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/prometheus/client_golang/prometheus"
)

// Evaluate evaluates access to the given resource, using provided AccessControl instance.
// Scopes are evaluated with an `OR` relationship.
// TODO: merge with dsl and rename package?
func Evaluate(ctx context.Context, ac accesscontrol.AccessControl, user *models.SignedInUser, eval accesscontrol.Eval) (bool, error) {
	timer := prometheus.NewTimer(metrics.MAccessEvaluationsSummary)
	defer timer.ObserveDuration()
	metrics.MAccessEvaluationCount.Inc()

	permissions, err := ac.GetUserPermissions(ctx, user)
	if err != nil {
		return false, err
	}

	return eval.Evaluate(accesscontrol.GroupPermissions(permissions))
}
