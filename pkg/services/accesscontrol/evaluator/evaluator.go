package evaluator

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/gobwas/glob"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/prometheus/client_golang/prometheus"
)

// Evaluate evaluates access to the given resource, using provided AccessControl instance.
// Scopes are evaluated with an `OR` relationship.
func Evaluate(ctx context.Context, ac accesscontrol.AccessControl, user *models.SignedInUser, action string, scope ...string) (bool, error) {
	timer := prometheus.NewTimer(metrics.MAccessEvaluationsSummary)
	defer timer.ObserveDuration()
	metrics.MAccessEvaluationCount.Inc()
	userPermissions, err := ac.GetUserPermissions(ctx, user)
	if err != nil {
		return false, err
	}

	ok, dbScopes := extractScopes(userPermissions, action)
	if !ok {
		return false, nil
	}

	res, err := evaluateScope(dbScopes, scope...)
	return res, err
}

func evaluateScope(dbScopes map[string]struct{}, targetScopes ...string) (bool, error) {
	if len(targetScopes) == 0 {
		return true, nil
	}

	logger := log.New("accesscontrol.permissioncheck")
	for _, s := range targetScopes {

		var match bool
		for dbScope := range dbScopes {
			if strings.ContainsAny(s, "*?") {
				logger.Error(fmt.Sprintf("Invalid scope: %v should not contain meta-characters like * or ?", s, dbScope))
			}
			rule, err := glob.Compile(dbScope, ':', '/')
			if err != nil {
				return false, err
			}

			match = rule.Match(s)
			if match {
				logger.Debug(fmt.Sprintf("Access control: matched scope %v against permission %v", s, dbScope))
				return true, nil
			}
		}
	}

	logger.Debug(fmt.Sprintf("Access control: failed!  Could not match scopes  %v against permissions %v", targetScopes, dbScopes))
	return false, nil
}

func extractScopes(permissions []*accesscontrol.Permission, targetAction string) (bool, map[string]struct{}) {
	scopes := map[string]struct{}{}
	ok := false

	for _, p := range permissions {
		if p == nil {
			continue
		}
		if p.Action == targetAction {
			ok = true
			scopes[p.Scope] = struct{}{}
		}
	}

	return ok, scopes
}
