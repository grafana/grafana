package acimpl

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/accesscontrol/acimpl")

var _ accesscontrol.AccessControl = new(AccessControl)

func ProvideAccessControl(features featuremgmt.FeatureToggles) *AccessControl {
	logger := log.New("accesscontrol")

	return &AccessControl{
		features:  features,
		log:       logger,
		resolvers: accesscontrol.NewResolvers(logger),
		primary:   setting.ZanzanaPrimaryEngineRBAC,
		metrics:   newFallbackMetrics(nil),
	}
}

type fallbackPermissionChecker interface {
	CheckPermission(context.Context, *authzextv1.CheckPermissionRequest) (*authzextv1.CheckPermissionResponse, error)
}

func ProvideAccessControlWithFallback(features featuremgmt.FeatureToggles, cfg *setting.Cfg, client *zanzana.PermissionCheckerProxy, reg prometheus.Registerer) *AccessControl {
	a := ProvideAccessControl(features)
	a.checker = client
	a.primary = cfg.ZanzanaClient.PrimaryEngine
	a.metrics = newFallbackMetrics(reg)
	return a
}

func ProvideAccessControlTest() *AccessControl {
	return ProvideAccessControl(featuremgmt.WithFeatures())
}

type AccessControl struct {
	features  featuremgmt.FeatureToggles
	log       log.Logger
	resolvers accesscontrol.Resolvers
	checker   fallbackPermissionChecker
	primary   setting.ZanzanaPrimaryEngine
	metrics   *fallbackMetrics
}

// fallbackShadowTimeout bounds comparison work that intentionally outlives the
// primary request so a slow shadow engine cannot accumulate goroutines.
const fallbackShadowTimeout = 5 * time.Second

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

	permissions := permissionsForUser(user)
	//nolint:staticcheck // rollout is intentionally using the legacy feature-toggle API.
	fallbackEnabled := a.features != nil && a.features.IsEnabledGlobally(featuremgmt.FlagZanzanaRBACFallbackChecks)
	if !fallbackEnabled || a.checker == nil {
		return a.evaluateRBAC(ctx, user, evaluator, permissions)
	}

	// The primary engine is the only synchronous authority. The other engine runs
	// after the decision for comparison and must never change the returned result.
	if a.primary == setting.ZanzanaPrimaryEngineZanzana {
		allowed, err := a.observeEngine("zanzana", func() (bool, error) {
			return a.evaluateFallback(ctx, user, evaluator, permissions)
		})
		if err != nil {
			a.metrics.comparisons.WithLabelValues("zanzana_error").Inc()
			// Do not return a potentially stale RBAC allow when the configured
			// authority fails. The detached RBAC run is diagnostic only.
			a.shadowRBAC(ctx, user, evaluator, permissions)
			return false, err
		}
		a.shadowRBACComparison(ctx, user, evaluator, permissions, allowed)
		return allowed, nil
	}

	allowed, err := a.observeEngine("rbac", func() (bool, error) {
		return a.evaluateRBAC(ctx, user, evaluator, permissions)
	})
	if err != nil {
		a.metrics.comparisons.WithLabelValues("rbac_error").Inc()
		return false, err
	}
	a.shadowZanzanaComparison(ctx, user, evaluator, permissions, allowed)
	return allowed, nil
}

func permissionsForUser(user identity.Requester) map[string][]string {
	// If the user is in no organization, then the evaluation must happen based on the user's global permissions
	if user.GetOrgID() == accesscontrol.NoOrgID {
		return user.GetGlobalPermissions()
	}
	return user.GetPermissions()
}

func (a *AccessControl) evaluateRBAC(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator, permissions map[string][]string) (bool, error) {
	if len(permissions) == 0 {
		a.debug(ctx, user, "No permissions set", evaluator)
		return false, nil
	}
	return a.evaluateWithResolvers(ctx, user, evaluator, func(eval accesscontrol.Evaluator) (bool, error) {
		return eval.Evaluate(permissions), nil
	})
}

func (a *AccessControl) evaluateFallback(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator, permissions map[string][]string) (bool, error) {
	return a.evaluateWithResolvers(ctx, user, evaluator, func(eval accesscontrol.Evaluator) (bool, error) {
		return eval.EvaluateCustom(func(action string, scopes ...string) (bool, error) {
			return a.checkFallbackLeaf(ctx, user, permissions, action, scopes...)
		})
	})
}

func (a *AccessControl) evaluateWithResolvers(
	ctx context.Context,
	user identity.Requester,
	evaluator accesscontrol.Evaluator,
	check func(accesscontrol.Evaluator) (bool, error),
) (bool, error) {
	a.debug(ctx, user, "Evaluating permissions", evaluator)
	// Test evaluation without scope resolver first, this will prevent 403 for wildcard scopes when resource does not exist
	// Resolving may require loading the referenced object, which is unnecessary when
	// the unresolved evaluator already matches a wildcard grant.
	allowed, err := check(evaluator)
	if err != nil || allowed {
		return allowed, err
	}

	resolvedEvaluator, err := evaluator.MutateScopes(ctx, a.resolvers.GetScopeAttributeMutator(user.GetOrgID()))
	if err != nil {
		if errors.Is(err, accesscontrol.ErrResolverNotFound) {
			return false, nil
		}
		return false, err
	}

	a.debug(ctx, user, "Evaluating resolved permissions", resolvedEvaluator)
	return check(resolvedEvaluator)
}

func (a *AccessControl) checkFallbackLeaf(ctx context.Context, user identity.Requester, permissions map[string][]string, action string, scopes ...string) (bool, error) {
	if len(scopes) == 0 {
		scopes = []string{""}
	}
	hasAccessToken := user.GetAccessToken() != ""
	persistentSubject := authlib.IsIdentityType(
		user.GetIdentityType(),
		authlib.TypeUser,
		authlib.TypeServiceAccount,
		authlib.TypeAnonymous,
	)
	if hasAccessToken && !persistentSubject {
		// Token-defined identities such as access policies have no persistent
		// Zanzana subject; their signed permission map is the authority.
		return permissionMapAllowsLeaf(permissions, action, scopes...), nil
	}
	if hasAccessToken && len(user.GetTokenDelegatedPermissions()) > 0 {
		// Delegated permissions are a ceiling on the persistent subject's grants.
		// A raw access token alone does not imply delegation or downscoping.
		if !permissionMapAllowsLeaf(permissions, action, scopes...) {
			return false, nil
		}
	}

	// Validate every alternative scope before sending the leaf. Otherwise a mixed
	// evaluator could hide malformed permission requirements behind a valid allow.
	for _, scope := range scopes {
		if scope == "" {
			if zanzana.ClassifyPermission(zanzana.RolePermission{Action: action}) == zanzana.Invalid {
				return false, fmt.Errorf("invalid permission requirement for action %q", action)
			}
			continue
		}

		kind, attribute, identifier := accesscontrol.SplitScope(scope)
		switch zanzana.ClassifyPermission(zanzana.RolePermission{
			Action: action, Scope: scope, Kind: kind, Attribute: attribute, Identifier: identifier,
		}) {
		case zanzana.Native, zanzana.Fallback:
		case zanzana.Invalid:
			return false, fmt.Errorf("invalid permission requirement for action %q", action)
		}
	}

	namespace := user.GetNamespace()
	// Legacy HTTP identities may predate explicit namespaces. Their positive org ID
	// still provides an unambiguous namespace for the Zanzana request.
	if namespace == "" && user.GetOrgID() > 0 {
		namespace = authlib.OrgNamespaceFormatter(user.GetOrgID())
	}
	if namespace == "" {
		return false, errors.New("zanzana permission check requires a namespace")
	}

	// GetGroups is the effective group set used by forward authorization. Do not
	// union another team source here or contextual tuples could broaden the grant.
	res, err := a.checker.CheckPermission(ctx, &authzextv1.CheckPermissionRequest{
		Namespace: namespace,
		Subject:   user.GetUID(),
		Teams:     user.GetGroups(),
		Action:    action,
		Scopes:    scopes,
	})
	if err != nil {
		a.metrics.checks.WithLabelValues("error").Inc()
		return false, fmt.Errorf("zanzana permission check failed: %w", err)
	}
	if res.GetAllowed() {
		a.metrics.checks.WithLabelValues("allow").Inc()
		return true, nil
	}
	a.metrics.checks.WithLabelValues("deny").Inc()
	return false, nil
}

func permissionMapAllowsLeaf(permissions map[string][]string, action string, scopes ...string) bool {
	for _, scope := range scopes {
		if scope == "" {
			// Legacy scopeless semantics ask whether the action exists at all; the
			// concrete scopes stored under it are deliberately ignored.
			_, allowed := permissions[action]
			return allowed
		}
	}
	return accesscontrol.EvalPermission(action, scopes...).Evaluate(permissions)
}

func (a *AccessControl) observeEngine(engine string, fn func() (bool, error)) (bool, error) {
	start := time.Now()
	defer func() { a.metrics.duration.WithLabelValues(engine).Observe(time.Since(start).Seconds()) }()
	return fn()
}

func (a *AccessControl) shadowZanzanaComparison(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator, permissions map[string][]string, rbacAllowed bool) {
	go func() {
		// The HTTP request may finish as soon as the primary returns, so detach its
		// cancellation while retaining a strict timeout for comparison work.
		shadowCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), fallbackShadowTimeout)
		defer cancel()
		allowed, err := a.observeEngine("zanzana", func() (bool, error) {
			return a.evaluateFallback(shadowCtx, user, evaluator, permissions)
		})
		a.recordComparison(shadowCtx, evaluator, rbacAllowed, allowed, err, "zanzana")
	}()
}

func (a *AccessControl) shadowRBACComparison(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator, permissions map[string][]string, zanzanaAllowed bool) {
	go func() {
		shadowCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), fallbackShadowTimeout)
		defer cancel()
		allowed, err := a.observeEngine("rbac", func() (bool, error) {
			return a.evaluateRBAC(shadowCtx, user, evaluator, permissions)
		})
		a.recordComparison(shadowCtx, evaluator, allowed, zanzanaAllowed, err, "rbac")
	}()
}

func (a *AccessControl) shadowRBAC(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator, permissions map[string][]string) {
	go func() {
		shadowCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), fallbackShadowTimeout)
		defer cancel()
		_, err := a.observeEngine("rbac", func() (bool, error) {
			return a.evaluateRBAC(shadowCtx, user, evaluator, permissions)
		})
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(shadowCtx.Err(), context.DeadlineExceeded) {
			a.metrics.comparisons.WithLabelValues("shadow_timeout").Inc()
		} else if err != nil {
			a.metrics.comparisons.WithLabelValues("rbac_error").Inc()
		}
	}()
}

func (a *AccessControl) recordComparison(ctx context.Context, evaluator accesscontrol.Evaluator, rbacAllowed, zanzanaAllowed bool, err error, shadowEngine string) {
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
			a.metrics.comparisons.WithLabelValues("shadow_timeout").Inc()
			return
		}
		a.metrics.comparisons.WithLabelValues(shadowEngine + "_error").Inc()
		return
	}

	result := "match"
	if zanzanaAllowed && !rbacAllowed {
		result = "zanzana_allow_rbac_deny"
	} else if !zanzanaAllowed && rbacAllowed {
		result = "zanzana_deny_rbac_allow"
	}
	a.metrics.comparisons.WithLabelValues(result).Inc()
	if result != "match" {
		// Count every mismatch, but sample logs deterministically by evaluator. This
		// bounds volume and avoids placing raw scopes or subjects in log fields.
		hash := sha256.Sum256([]byte(evaluator.GoString()))
		if hash[0]&0x0f == 0 {
			a.log.FromContext(ctx).Warn("Zanzana result does not match RBAC",
				"action", evaluator.String(), "scope_hash", fmt.Sprintf("%x", hash[:8]),
				"rbac_allowed", rbacAllowed, "zanzana_allowed", zanzanaAllowed)
		}
	}
}

func (a *AccessControl) RegisterScopeAttributeResolver(prefix string, resolver accesscontrol.ScopeAttributeResolver) {
	a.resolvers.AddScopeAttributeResolver(prefix, resolver)
}

func (a *AccessControl) WithoutResolvers() accesscontrol.AccessControl {
	return &AccessControl{
		features:  a.features,
		log:       a.log,
		resolvers: accesscontrol.NewResolvers(a.log),
		checker:   a.checker,
		primary:   a.primary,
		metrics:   a.metrics,
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
