package pluginroute

import (
	"context"
	"strings"

	claims "github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/kindstore"
)

// clusterReadVerbs are the only verbs a user may run against a cluster-scoped
// kind, and only one the manifest marks user readable. Watch is left to service
// identities, as the apiextensions authorizer does for cluster-scoped CRDs.
var clusterReadVerbs = map[string]bool{
	utils.VerbGet:  true,
	utils.VerbList: true,
}

// kindPolicy is what authorizing a manifest kind needs to know about it.
type kindPolicy struct {
	clusterScoped bool
	userReadable  bool
	// customRoutes are the subresources the manifest mounts for this kind,
	// unioned across its served versions -- the authorizer runs before the
	// request is dispatched to one.
	customRoutes map[string]bool
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
				continue // kindstore.New refuses these, so they have no resource
			}
			resource := strings.ToLower(kind.Plural)
			policy, seen := policies[resource]
			if !seen {
				policy = kindPolicy{
					clusterScoped: kind.Scope == kindstore.ClusterScope,
					userReadable:  kind.UserReadable,
					customRoutes:  map[string]bool{},
				}
			}
			policies[resource] = policy
		}

		// Only the first segment can be a subresource.
		for _, route := range parseManifestRoutes(version, func(string, string) {}) {
			if route.kind == nil {
				continue
			}
			sub, _, _ := strings.Cut(route.subresource, "/")
			policies[strings.ToLower(route.kind.Plural)].customRoutes[sub] = true
		}
	}
	return policies
}

func (b *manifestBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}
			decision, reason, err := b.accessChecker(ctx, user, b.pluginID)
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
func (b *manifestBuilder) authorizeKind(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	policy, ok := b.kindPolicies[attr.GetResource()]
	if !ok || !policy.clusterScoped {
		return authorizer.DecisionAllow, "", nil
	}

	// A custom route never reaches unified storage, so the plugin's app access
	// -- already checked above -- is what authorizes it. The read-only rule
	// below governs the objects the kind stores, not the routes it serves.
	if policy.customRoutes[attr.GetSubresource()] {
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
