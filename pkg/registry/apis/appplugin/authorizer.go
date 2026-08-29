package appplugin

import (
	"context"
	"strings"

	claims "github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	pluginaccesscontrol "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
)

// Structured so we can more easily replace with the MT access client
type PluginAccessChecker = func(ctx context.Context, user identity.Requester, pluginID string) (authorized authorizer.Decision, reason string, err error)

func NewPluginAccessChecker(accessControl ac.AccessControl) PluginAccessChecker {
	return func(ctx context.Context, user identity.Requester, pluginID string) (authorized authorizer.Decision, reason string, err error) {
		scope := pluginaccesscontrol.ScopeProvider.GetResourceScope(pluginID)
		// Authorize the caller using the same permission as the legacy endpoint:
		//   ac.EvalPermission(pluginaccesscontrol.ActionAppAccess, plugins:id:<pluginID>)
		ok, err := accessControl.Evaluate(ctx, user, ac.EvalPermission(pluginaccesscontrol.ActionAppAccess, scope))
		if err != nil {
			return authorizer.DecisionDeny, "authorization check failed", err
		}
		if !ok {
			return authorizer.DecisionDeny, "access denied", nil
		}
		return authorizer.DecisionAllow, "", nil
	}
}

// clusterReadVerbs are the only verbs a user may run against a cluster-scoped
// kind, and only one the manifest marks user readable.
var clusterReadVerbs = map[string]bool{utils.VerbGet: true, utils.VerbList: true}

// kindPolicy is what authorizing a manifest kind needs to know about it.
type kindPolicy struct {
	clusterScoped bool
	userReadable  bool
}

// kindPolicies indexes a manifest's kinds by the resource name they are served
// under. Scope and readability must match across a kind's versions, so the
// first version to declare a kind decides.
func kindPolicies(manifest *app.ManifestData) map[string]kindPolicy {
	if manifest == nil {
		return nil
	}
	policies := map[string]kindPolicy{}
	for _, version := range manifest.Versions {
		if !version.Served {
			continue
		}
		for _, kind := range version.Kinds {
			if kind.Plural == "" {
				continue // newKindStore refuses these, so they have no resource
			}
			resource := strings.ToLower(kind.Plural)
			if _, seen := policies[resource]; seen {
				continue
			}
			policies[resource] = kindPolicy{
				clusterScoped: kind.Scope == clusterScope,
				userReadable:  kind.UserReadable,
			}
		}
	}
	return policies
}

func (b *AppPluginAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}
			decision, reason, err := b.accessChecker(ctx, user, b.pluginJSON.ID)
			if decision != authorizer.DecisionAllow {
				return decision, reason, err
			}
			return b.authorizeKind(ctx, attr)
		},
	)
}

// authorizeKind applies to a manifest kind the rules apiextensions applies to a
// CRD (clusterScopedCRDAuthorizer). A namespaced kind is allowed here and
// decided at the storage layer, which can resolve the object's folder and run
// the folder-aware RBAC check. A cluster-scoped kind has no folder to decide
// by, so users only reach the ones the manifest marks user readable, and only
// to read them.
func (b *AppPluginAPIBuilder) authorizeKind(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	policy, ok := b.kindPolicies[attr.GetResource()]
	if !ok || !policy.clusterScoped {
		return authorizer.DecisionAllow, "", nil
	}

	// Service identities operate cluster-scoped kinds; their access was already
	// decided by the plugin's app access above.
	if authInfo, ok := claims.AuthInfoFrom(ctx); ok &&
		claims.IsIdentityType(authInfo.GetIdentityType(), claims.TypeAccessPolicy) {
		return authorizer.DecisionAllow, "", nil
	}

	if !policy.userReadable {
		return authorizer.DecisionDeny, "cluster-scoped resource not readable by users", nil
	}
	if clusterReadVerbs[attr.GetVerb()] {
		return authorizer.DecisionAllow, "", nil
	}
	return authorizer.DecisionDeny, "verb not permitted for cluster-scoped resource", nil
}
