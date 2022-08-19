package ossaccesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
)

var _ accesscontrol.AccessControl = new(AccessControl)

func ProvideAccessControl(cfg *setting.Cfg) *AccessControl {
	logger := log.New("accesscontrol")
	return &AccessControl{
		cfg, logger, NewResolvers(logger),
	}
}

type AccessControl struct {
	cfg       *setting.Cfg
	log       log.Logger
	resolvers Resolvers
}

func (a *AccessControl) Evaluate(ctx context.Context, user *user.SignedInUser, evaluator accesscontrol.Evaluator) (bool, error) {
	timer := prometheus.NewTimer(metrics.MAccessEvaluationsSummary)
	defer timer.ObserveDuration()
	metrics.MAccessEvaluationCount.Inc()

	if user.Permissions == nil {
		return false, accesscontrol.ErrMissingPermissions
	}

	if _, ok := user.Permissions[user.OrgID]; !ok {
		return false, accesscontrol.ErrMissingPermissionsOrg
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

func (a *AccessControl) IsDisabled() bool {
	return accesscontrol.IsDisabled(a.cfg)
}
