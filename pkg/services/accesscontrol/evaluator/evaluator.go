package evaluator

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/prometheus/client_golang/prometheus"
)

var logger = log.New("accesscontrol.evaluator")

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

	for _, s := range targetScopes {
		for dbScope := range dbScopes {
			if dbScope == "" {
				continue
			}

			if !accesscontrol.ValidateScope(dbScope) {
				logger.Error(
					"invalid scope",
					"reason", fmt.Sprintf("%v should not contain meta-characters like * or ?, except in the last position", dbScope),
					"scope", dbScope,
				)
				continue
			}

			prefix, last := dbScope[:len(dbScope)-1], dbScope[len(dbScope)-1]
			//Prefix match
			if last == '*' {
				if strings.HasPrefix(s, prefix) {
					logger.Debug(
						"matched scope",
						"reason", fmt.Sprintf("matched request scope %v against resource scope %v", dbScope, s),
						"request scope", dbScope,
						"resource scope", s,
					)
					return true, nil
				}
			}

			if s == dbScope {
				return true, nil
			}
		}
	}

	logger.Debug(
		"access control failed",
		"request scope", dbScopes,
		"resource scope", targetScopes,
		"reason", fmt.Sprintf("Could not match resource scopes  %v with request scopes %v", dbScopes, targetScopes),
	)
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
