package acimpl

import (
	"context"
	"errors"

	"github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/accesscontrol/acimpl")

var _ accesscontrol.AccessControl = (*AccessControl)(nil)

func ProvideAccessControl(features featuremgmt.FeatureToggles) *AccessControl {
	logger := log.New("accesscontrol")

	return &AccessControl{
		features:          features,
		log:               logger,
		resolvers:         accesscontrol.NewResolvers(logger),
		openFeatureClient: openfeature.NewDefaultClient(),
	}
}

func ProvideAccessControlTest() *AccessControl {
	return ProvideAccessControl(featuremgmt.WithFeatures())
}

func ProvideScopeResolverRegistry(ac *AccessControl) *accesscontrol.ScopeResolverRegistry {
	return ac.resolvers.ScopeResolverRegistry()
}

type AccessControl struct {
	features            featuremgmt.FeatureToggles
	log                 log.Logger
	resolvers           accesscontrol.Resolvers
	skipScopeResolution bool
	openFeatureClient   *openfeature.Client
	legacyCheckClient   *legacyclient.LegacyClient
	useExternalGroups   bool
	legacyNamespace     types.NamespaceFormatter
}

func (a *AccessControl) Evaluate(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.Evaluate")
	defer span.End()

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

	if a.openFeatureClient.Boolean(ctx, featuremgmt.FlagAuthzUseLegacyCheck, false, openfeature.TransactionContext(ctx)) {
		return a.evaluateLegacyCheck(ctx, user, evaluator)
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

func (a *AccessControl) WithoutResolvers() accesscontrol.AccessControl {
	return &AccessControl{
		features:            a.features,
		log:                 a.log,
		resolvers:           accesscontrol.NewResolvers(a.log),
		skipScopeResolution: true,
		openFeatureClient:   a.openFeatureClient,
		legacyCheckClient:   a.legacyCheckClient,
		useExternalGroups:   a.useExternalGroups,
		legacyNamespace:     a.legacyNamespace,
	}
}

func (a *AccessControl) InvalidateResolverCache(orgID int64, scope string) {
	a.resolvers.InvalidateCache(orgID, scope)
}

func (a *AccessControl) debug(ctx context.Context, ident identity.Requester, msg string, eval accesscontrol.Evaluator) {
	ctx, span := tracer.Start(ctx, "accesscontrol.acimpl.debug")
	defer span.End()

	a.log.FromContext(ctx).Debug(msg, "id", ident.GetID(), "orgID", ident.GetOrgID(), "permissions", eval.GoString())
}
