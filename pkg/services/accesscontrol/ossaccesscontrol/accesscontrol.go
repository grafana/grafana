package ossaccesscontrol

import (
	"context"
	"errors"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var _ accesscontrol.AccessControl = new(AccessControl)

func ProvideAccessControl(cfg *setting.Cfg, service accesscontrol.Service) *AccessControl {
	logger := log.New("accesscontrol")
	return &AccessControl{
		cfg, logger, accesscontrol.NewResolvers(logger), service,
	}
}

type AccessControl struct {
	cfg       *setting.Cfg
	log       log.Logger
	resolvers accesscontrol.Resolvers
	service   accesscontrol.Service
}

func (a *AccessControl) Evaluate(ctx context.Context, user *user.SignedInUser, evaluator accesscontrol.Evaluator) (bool, error) {
	timer := prometheus.NewTimer(metrics.MAccessEvaluationsSummary)
	defer timer.ObserveDuration()
	metrics.MAccessEvaluationCount.Inc()

	if user.Permissions == nil {
		user.Permissions = map[int64]map[string][]string{}
	}

	if _, ok := user.Permissions[user.OrgID]; !ok {
		permissions, err := a.service.GetUserPermissions(ctx, user, accesscontrol.Options{ReloadCache: true})
		if err != nil {
			return false, err
		}
		user.Permissions[user.OrgID] = accesscontrol.GroupScopesByAction(permissions)
	}

	// Test evaluation without scope resolver first, this will prevent 403 for wildcard scopes when resource does not exist
	if evaluator.Evaluate(user.Permissions[user.OrgID]) {
		return true, nil
	}

	resolvedEvaluator, err := evaluator.MutateScopes(ctx, a.resolvers.GetScopeAttributeMutator(user.OrgID))
	if err != nil {
		if errors.Is(err, accesscontrol.ErrResolverNotFound) {
			return false, nil
		}
		return false, err
	}

	return resolvedEvaluator.Evaluate(user.Permissions[user.OrgID]), nil
}

func (a *AccessControl) RegisterScopeAttributeResolver(prefix string, resolver accesscontrol.ScopeAttributeResolver) {
	a.resolvers.AddScopeAttributeResolver(prefix, resolver)
}

func (a *AccessControl) IsDisabled() bool {
	return accesscontrol.IsDisabled(a.cfg)
}
