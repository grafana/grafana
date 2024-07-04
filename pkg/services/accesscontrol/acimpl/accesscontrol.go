package acimpl

import (
	"context"
	"errors"
	"time"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var _ accesscontrol.AccessControl = new(AccessControl)

func ProvideAccessControl(features featuremgmt.FeatureToggles, zclient zanzana.Client) *AccessControl {
	logger := log.New("accesscontrol")
	return &AccessControl{
		features, logger, accesscontrol.NewResolvers(logger), zclient,
	}
}

func ProvideAccessControlTest() *AccessControl {
	return ProvideAccessControl(featuremgmt.WithFeatures(), zanzana.NewNoopClient())
}

type AccessControl struct {
	features  featuremgmt.FeatureToggles
	log       log.Logger
	resolvers accesscontrol.Resolvers
	zclient   zanzana.Client
}

func (a *AccessControl) Evaluate(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	if a.features.IsEnabledGlobally(featuremgmt.FlagZanzana) {
		return a.evaluateCompare(ctx, user, evaluator)
	}

	return a.evaluate(ctx, user, evaluator)
}

func (a *AccessControl) evaluate(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
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

func (a *AccessControl) evaluateZanzana(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	eval, err := evaluator.MutateScopes(ctx, a.resolvers.GetScopeAttributeMutator(user.GetOrgID()))
	if err != nil {
		if !errors.Is(err, accesscontrol.ErrResolverNotFound) {
			return false, err
		}
		eval = evaluator
	}

	return eval.EvaluateCustom(func(action, scope string) (bool, error) {
		kind, _, identifier := accesscontrol.SplitScope(scope)
		key, ok := zanzana.TranslateToTuple(user.GetUID().String(), action, kind, identifier, user.GetOrgID())
		if !ok {
			// unsupported translation
			return false, nil
		}

		res, err := a.zclient.Check(ctx, &openfgav1.CheckRequest{
			TupleKey: &openfgav1.CheckRequestTupleKey{
				User:     key.User,
				Relation: key.Relation,
				Object:   key.Object,
			},
		})

		if err != nil {
			return false, err
		}

		return res.Allowed, nil
	})
}

type evalResult struct {
	runner   string
	decision bool
	err      error
	duration time.Duration
}

// evaluateCompare run RBAC and zanzana checks in parallel and then compare result
func (a *AccessControl) evaluateCompare(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	res := make(chan evalResult, 2)
	go func() {
		start := time.Now()
		hasAccess, err := a.evaluateZanzana(ctx, user, evaluator)
		res <- evalResult{"zanzana", hasAccess, err, time.Since(start)}
	}()

	go func() {
		start := time.Now()
		hasAccess, err := a.evaluate(ctx, user, evaluator)
		res <- evalResult{"grafana", hasAccess, err, time.Since(start)}
	}()
	first, second := <-res, <-res
	close(res)

	if second.runner == "grafana" {
		first, second = second, first
	}

	if first.decision != second.decision {
		a.log.Warn(
			"zanzana evaluation result does not match grafana",
			"grafana_decision", first.decision,
			"zanana_decision", second.decision,
			"grafana_ms", first.duration,
			"zanzana_ms", second.duration,
			"eval", evaluator.GoString(),
		)
	} else {
		a.log.Debug("zanzana evaluation is correct", "grafana_ms", first.duration, "zanzana_ms", second.duration)
	}

	return first.decision, first.err
}

func (a *AccessControl) RegisterScopeAttributeResolver(prefix string, resolver accesscontrol.ScopeAttributeResolver) {
	a.resolvers.AddScopeAttributeResolver(prefix, resolver)
}

func (a *AccessControl) debug(ctx context.Context, ident identity.Requester, msg string, eval accesscontrol.Evaluator) {
	namespace, id := ident.GetNamespacedID()
	a.log.FromContext(ctx).Debug(msg, "namespace", namespace, "id", id, "orgID", ident.GetOrgID(), "permissions", eval.GoString())
}
