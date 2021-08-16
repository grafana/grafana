package evaluator

import (
	"context"
	"errors"
	"fmt"
	"strings"

	l "log"

	"github.com/gobwas/glob"
	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/prometheus/client_golang/prometheus"
)

// Evaluate evaluates access to the given resource, using provided AccessControl instance.
// Scopes are evaluated with an `OR` relationship.
func Evaluate(ctx context.Context, ac accesscontrol.AccessControl, user *models.SignedInUser, action string, resourceScopes ...string) (bool, error) {
	timer := prometheus.NewTimer(metrics.MAccessEvaluationsSummary)
	defer timer.ObserveDuration()
	metrics.MAccessEvaluationCount.Inc()
	userPermissions, err := ac.GetUserPermissions(ctx, user)
	if err != nil {
		return false, err
	}

	ok, requestScopes := extractScopes(userPermissions, action)
	if !ok {
		return false, nil
	}

	res, err := evaluateScope(requestScopes, resourceScopes...)
	return res, err
}

func evaluateScope(requestScopes map[string]struct{}, resourceScopes ...string) (bool, error) {
	if len(resourceScopes) == 0 {
		return true, nil
	}

	logger := log.New("accesscontrol.permissioncheck")
	for _, resourceScope := range resourceScopes {

		var match bool
		for requestScope := range requestScopes {
			if strings.ContainsAny(resourceScope, "*?") {
				msg := fmt.Sprintf("Invalid scope: %v should not contain meta-characters like * or ?", resourceScope)
				l.Println(msg)
				logger.Error(msg)
				panic(msg)
				return false, errors.New(msg)
			}
			rule, err := glob.Compile(requestScope, ':', '/')
			if err != nil {
				return false, err
			}

			match = rule.Match(resourceScope)
			if match {
				msg := fmt.Sprintf("Access control: matched request scope %v against resource scope %v", requestScope, resourceScope)
				l.Println(msg)
				logger.Debug(msg)
				return true, nil
			}
		}
	}
	msg := fmt.Sprintf("Access control: failed!  Could not match resource scopes  %v with request scope %v", resourceScopes, requestScopes)
	l.Println(msg)
	logger.Debug(msg)
	panic(msg)
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
