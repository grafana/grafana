package acimpl

import (
	"context"
	"errors"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/setting"
)

var _ accesscontrol.AccessControl = new(AccessControl)

func ProvideAccessControl(cfg *setting.Cfg) *AccessControl {
	logger := log.New("accesscontrol")
	return &AccessControl{
		cfg, logger, accesscontrol.NewResolvers(logger),
	}
}

type AccessControl struct {
	cfg       *setting.Cfg
	log       log.Logger
	resolvers accesscontrol.Resolvers
}

func (a *AccessControl) Evaluate(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	timer := prometheus.NewTimer(metrics.MAccessEvaluationsSummary)
	defer timer.ObserveDuration()
	metrics.MAccessEvaluationCount.Inc()

	if user == nil || user.IsNil() {
		a.log.Warn("No entity set for access control evaluation")
		return false, nil
	}

	// If the user is in no organization, then the evaluation must happen based on the user's global permissions
	permissions := user.GetPermissions()
	if user.GetOrgID() == accesscontrol.NoOrgID {
		permissions = user.GetGlobalPermissions()
	}
	if len(permissions) == 0 {
		a.debug(ctx, user, "No permissions set", evaluator)
		return false, nil
	}

	a.debug(ctx, user, "Evaluating permissions", evaluator)
	// Test evaluation without scope resolver first, this will prevent 403 for wildcard scopes when resource does not exist
	if evaluator.Evaluate(permissions) {
		return true, nil
	}

	resolvedEvaluator, err := evaluator.MutateScopes(ctx, a.resolvers.GetScopeAttributeMutator(user.GetOrgID()))
	if err != nil {
		if errors.Is(err, accesscontrol.ErrResolverNotFound) {
			return false, nil
		}
		return false, err
	}

	a.debug(ctx, user, "Evaluating resolved permissions", resolvedEvaluator)
	return resolvedEvaluator.Evaluate(permissions), nil
}

func (a *AccessControl) RegisterScopeAttributeResolver(prefix string, resolver accesscontrol.ScopeAttributeResolver) {
	a.resolvers.AddScopeAttributeResolver(prefix, resolver)
}

func (a *AccessControl) debug(ctx context.Context, ident identity.Requester, msg string, eval accesscontrol.Evaluator) {
	namespace, id := ident.GetNamespacedID()
	a.log.FromContext(ctx).Debug(msg, "namespace", namespace, "id", id, "orgID", ident.GetOrgID(), eval.GoString())
}
