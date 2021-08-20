package evaluator

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
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

func ValidateScope(scope string) bool {
	prefix := scope[:len(scope)-1]
	return !strings.ContainsAny(prefix, "*?")
}

func evaluateScope(dbScopes map[string]struct{}, targetScopes ...string) (bool, error) {
	if len(targetScopes) == 0 {
		return true, nil
	}

	for _, s := range targetScopes {

		for dbScope := range dbScopes {
			if dbScope == "" {
				//Log an error?
			} else {
				prefix := dbScope[:len(dbScope)-1]
				lastChar := dbScope[len(dbScope)-1]
				if !ValidateScope(dbScope) {
					msg := "Invalid scope"
					reason := fmt.Sprintf("%v should not contain meta-characters like * or ?, except in the last position", dbScope)
					logger.Error(msg, "reason", reason, "scope", dbScope)
					return false, errors.New(msg)
				}

				msg := "Access control"
				reason := fmt.Sprintf("matched request scope %v against resource scope %v", dbScope, s)
				if lastChar == "*"[0] { //Prefix match
					match := strings.HasPrefix(s, prefix)
					if match {
						logger.Debug(msg, "reason", reason, "request scope", dbScope, "resource scope", s)
						return true, nil
					}
				} else {
					if s == dbScope { //Exact match
						logger.Debug(msg, "reason", reason, "request scope", dbScope, "resource scope", s)
						return true, nil
					}
				}
			}
		}
	}

	logger.Debug("Access control: failed!", "reason", fmt.Sprintf("Could not match resource scopes  %v with request scopes %v", dbScopes, targetScopes), "request scope", dbScopes, "resource scope", targetScopes)
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
