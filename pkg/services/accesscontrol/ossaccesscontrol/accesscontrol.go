package ossaccesscontrol

import (
	"context"

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

	resolvedEvaluator, err := evaluator.MutateScopes(ctx, a.resolvers.GetScopeAttributeMutator(user.OrgID))
	if err != nil {
		return false, err
	}
	return resolvedEvaluator.Evaluate(user.Permissions[user.OrgID]), nil
}

func (a *AccessControl) RegisterScopeAttributeResolver(prefix string, resolver accesscontrol.ScopeAttributeResolver) {
	a.resolvers.AddScopeAttributeResolver(prefix, resolver)
}

func (a *AccessControl) DeclareFixedRoles(registrations ...accesscontrol.RoleRegistration) error {
	// FIXME: Remove wrapped call
	return a.service.DeclareFixedRoles(registrations...)
}

func (a *AccessControl) IsDisabled() bool {
	return accesscontrol.IsDisabled(a.cfg)
}
