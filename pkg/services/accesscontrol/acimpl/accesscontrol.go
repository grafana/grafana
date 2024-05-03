package acimpl

import (
	"context"
	"errors"
	"strconv"
	"time"

	zclient "github.com/grafana/zanzana/pkg/service/client"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/embedserver"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/setting"
)

var _ accesscontrol.AccessControl = new(AccessControl)

func ProvideAccessControl(cfg *setting.Cfg, embed *embedserver.Service) *AccessControl {
	logger := log.New("accesscontrol")
	c, err := embed.GetClient(context.Background(), "1")
	if err != nil {
		panic(err)
	}

	return &AccessControl{
		cfg, logger, accesscontrol.NewResolvers(logger), c, embed,
	}
}

type AccessControl struct {
	cfg       *setting.Cfg
	log       log.Logger
	resolvers accesscontrol.Resolvers
	zclient   *zclient.GRPCClient
	zService  *embedserver.Service
}

type evalResult struct {
	runner   string
	decision bool
	err      error
	duration time.Duration
}

func (a *AccessControl) Evaluate(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	timer := prometheus.NewTimer(metrics.MAccessEvaluationsSummary)
	defer timer.ObserveDuration()
	metrics.MAccessEvaluationCount.Inc()

	if user == nil || user.IsNil() {
		a.log.Warn("No entity set for access control evaluation")
		return false, nil
	}

	if user.GetID() == "" {
		return false, nil
	}

	if a.zService.Cfg.SingleRead {
		return a.evalZanzana(ctx, user, evaluator)
	}

	res := make(chan evalResult, 2)
	go func() {
		start := time.Now()
		hasAccess, err := a.evalZanzana(ctx, user, evaluator)
		res <- evalResult{"zanzana", hasAccess, err, time.Since(start)}
	}()

	go func() {
		start := time.Now()
		hasAccess, err := a.evalGrafana(ctx, user, evaluator)
		res <- evalResult{"grafana", hasAccess, err, time.Since(start)}
	}()
	first, second := <-res, <-res
	close(res)

	if second.runner == "grafana" {
		first, second = second, first
	}

	if first.decision != second.decision {
		a.log.Error(
			"eval result diff",
			"grafana_desision", first.decision,
			"zanana_descision", second.decision,
			"grafana_ms", first.duration,
			"zanzana_ms", second.duration,
			"eval", evaluator.GoString(),
		)
	} else {
		a.log.Info("eval: correct result", "grafana_ms", first.duration, "zanzana_ms", second.duration)
	}

	if a.zService.Cfg.EvaluationResult {
		return second.decision, second.err
	}

	return first.decision, first.err
}

func (a *AccessControl) evalGrafana(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
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

func (a *AccessControl) evalZanzana(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	// TODO: let evaluator issue request, then we don't have to rebuild a tree
	eval, err := evaluator.MutateScopes(ctx, a.resolvers.GetScopeAttributeMutator(user.GetOrgID()))
	if err != nil {
		if !errors.Is(err, accesscontrol.ErrResolverNotFound) {
			return false, err
		}
		eval = evaluator
	}

	return eval.EvaluateZanzana(ctx, user.GetID(), strconv.FormatInt(user.GetOrgID(), 10), a.zclient)
}

func (a *AccessControl) RegisterScopeAttributeResolver(prefix string, resolver accesscontrol.ScopeAttributeResolver) {
	a.resolvers.AddScopeAttributeResolver(prefix, resolver)
}

func (a *AccessControl) debug(ctx context.Context, ident identity.Requester, msg string, eval accesscontrol.Evaluator) {
	namespace, id := ident.GetNamespacedID()
	a.log.FromContext(ctx).Debug(msg, "namespace", namespace, "id", id, "orgID", ident.GetOrgID(), "permissions", eval.GoString())
}
