package acimpl

import (
	"context"
	"errors"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var (
	errAccessNotImplemented = errors.New("access control not implemented for resource")
	tracer                  = otel.Tracer("github.com/grafana/grafana/pkg/services/accesscontrol/acimpl")
)

var _ accesscontrol.AccessControl = new(AccessControl)

func ProvideAccessControl(features featuremgmt.FeatureToggles, zclient zanzana.Client) *AccessControl {
	logger := log.New("accesscontrol")

	var m *acMetrics
	if features.IsEnabledGlobally(featuremgmt.FlagZanzana) {
		m = initMetrics()
	}

	return &AccessControl{
		features,
		logger,
		accesscontrol.NewResolvers(logger),
		zclient,
		m,
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
	metrics   *acMetrics
}

func (a *AccessControl) Evaluate(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.Evaluate")
	defer span.End()

	if a.features.IsEnabledGlobally(featuremgmt.FlagZanzana) {
		return a.evaluateCompare(ctx, user, evaluator)
	}

	return a.evaluate(ctx, user, evaluator)
}

func (a *AccessControl) evaluate(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.evaluate")
	defer span.End()

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
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.evaluateZanzana")
	defer span.End()

	eval, err := evaluator.MutateScopes(ctx, a.resolvers.GetScopeAttributeMutator(user.GetOrgID()))
	if err != nil {
		if !errors.Is(err, accesscontrol.ErrResolverNotFound) {
			return false, err
		}
		eval = evaluator
	}

	return eval.EvaluateCustom(func(action string, scopes ...string) (bool, error) {
		// FIXME: handle action with no scopes
		if len(scopes) == 0 {
			return false, nil
		}

		resourceScope := scopes[0]
		kind, _, identifier := accesscontrol.SplitScope(resourceScope)

		// Parent folder always returned by scope resolver as a second value
		var parentFolder string
		if len(scopes) > 1 {
			_, _, parentFolder = accesscontrol.SplitScope(scopes[1])
		}

		req, ok := zanzana.TranslateToCheckRequest(user.GetNamespace(), action, kind, parentFolder, identifier)
		if !ok {
			// unsupported translation
			return false, errAccessNotImplemented
		}

		a.log.Debug("evaluating zanzana", "user", user.GetUID(), "namespace", req.Namespace, "verb", req.Verb, "resource", req.Resource, "name", req.Name)
		res, err := a.zclient.Check(ctx, user, *req)

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
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.evaluateCompare")
	defer span.End()

	res := make(chan evalResult, 2)
	go func() {
		timer := prometheus.NewTimer(a.metrics.mAccessEngineEvaluationsSeconds.WithLabelValues("zanzana"))
		defer timer.ObserveDuration()
		start := time.Now()

		hasAccess, err := a.evaluateZanzana(ctx, user, evaluator)
		res <- evalResult{"zanzana", hasAccess, err, time.Since(start)}
	}()

	go func() {
		timer := prometheus.NewTimer(a.metrics.mAccessEngineEvaluationsSeconds.WithLabelValues("grafana"))
		defer timer.ObserveDuration()
		start := time.Now()

		hasAccess, err := a.evaluate(ctx, user, evaluator)
		res <- evalResult{"grafana", hasAccess, err, time.Since(start)}
	}()
	first, second := <-res, <-res
	close(res)

	if second.runner == "grafana" {
		first, second = second, first
	}

	if !errors.Is(second.err, errAccessNotImplemented) {
		if second.err != nil {
			a.log.Error("zanzana evaluation failed", "error", second.err)
		} else if first.decision != second.decision {
			a.metrics.mZanzanaEvaluationStatusTotal.WithLabelValues("error").Inc()
			a.log.Warn(
				"zanzana evaluation result does not match grafana",
				"grafana_decision", first.decision,
				"zanana_decision", second.decision,
				"grafana_ms", first.duration,
				"zanzana_ms", second.duration,
				"eval", evaluator.GoString(),
			)
		} else {
			a.metrics.mZanzanaEvaluationStatusTotal.WithLabelValues("success").Inc()
			a.log.Debug("zanzana evaluation is correct", "grafana_ms", first.duration, "zanzana_ms", second.duration)
		}
	}

	return first.decision, first.err
}

func (a *AccessControl) RegisterScopeAttributeResolver(prefix string, resolver accesscontrol.ScopeAttributeResolver) {
	a.resolvers.AddScopeAttributeResolver(prefix, resolver)
}

func (a *AccessControl) WithoutResolvers() accesscontrol.AccessControl {
	return &AccessControl{
		features:  a.features,
		log:       a.log,
		zclient:   a.zclient,
		metrics:   a.metrics,
		resolvers: accesscontrol.NewResolvers(a.log),
	}
}

func (a *AccessControl) debug(ctx context.Context, ident identity.Requester, msg string, eval accesscontrol.Evaluator) {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.debug")
	defer span.End()

	a.log.FromContext(ctx).Debug(msg, "id", ident.GetID(), "orgID", ident.GetOrgID(), "permissions", eval.GoString())
}
