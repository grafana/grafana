package pluginroute

import (
	"context"
	"fmt"
	"strings"

	authzlib "github.com/grafana/authlib/authz"
	authlib "github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apiserverauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/apiserver/kindstore"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
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
		for _, route := range parseManifestRoutes(version, ignoreSkipped) {
			if route.Kind == nil {
				continue
			}
			sub, _, _ := strings.Cut(route.Subresource, "/")
			policies[strings.ToLower(route.Kind.Plural)].customRoutes[sub] = true
		}
	}
	return policies
}

func (b *manifestBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			requester, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			if apiserverauthorizer.IsSearchRequest(attr) || apiserverauthorizer.IsListKeysRequest(attr) {
				attr = apiserverauthorizer.AsReadAttributes(attr)
			}

			// Only service account types should use the status endpoint
			if !attr.IsReadOnly() && attr.GetSubresource() == "status" {
				if authlib.IsIdentityType(requester.GetIdentityType(), authlib.TypeUser, authlib.TypeAnonymous, authlib.TypeEmpty) {
					return authorizer.DecisionDeny, "Users may not directly modify status", nil
				}
			}

			if !serviceTokenGrants(requester, attr) {
				decision, reason, err := b.accessChecker(ctx, requester, b.pluginID)
				if decision != authorizer.DecisionAllow {
					return decision, reason, err
				}
			}
			return b.authorizeKind(requester, attr)
		},
	)
}

// serviceTokenGrants reports whether requester is an access policy whose token
// permissions grant the request. That stands in for app access, which an
// access policy can only hold for every app plugin at once. authorizeKind then
// holds it to the same permissions.
func serviceTokenGrants(requester identity.Requester, attr authorizer.Attributes) bool {
	if !authlib.IsIdentityType(requester.GetIdentityType(), authlib.TypeAccessPolicy) {
		return false
	}
	decision, _, _ := authorizeTokenPermissions(requester, attr)
	return decision == authorizer.DecisionAllow
}

// authorizeKind applies to a manifest kind the rules apiextensions applies to a
// CRD (clusterScopedCRDAuthorizer). A namespaced kind is allowed here and
// decided at the storage layer, which can resolve the object's folder and run
// the folder-aware RBAC check. A cluster-scoped kind has no folder to decide
// by, so users only reach the ones the manifest marks user readable, and only
// to read them. An access policy is held to its token's permissions for both.
func (b *manifestBuilder) authorizeKind(requester identity.Requester, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	// Not a kind: discovery, OpenAPI or a version route. None of them read the
	// kinds' storage, and a version route runs its own declared check. Any other
	// resource is not served.
	policy, ok := b.kindPolicies[attr.GetResource()]
	if !ok {
		return authorizer.DecisionAllow, "", nil
	}

	// A custom route never reaches unified storage, so the plugin's app access
	// -- already checked above -- and the route's own declared check are what
	// authorize it. The rules below govern the objects the kind stores, not the
	// routes it serves.
	if policy.customRoutes[attr.GetSubresource()] {
		return authorizer.DecisionAllow, "", nil
	}

	// Storage cannot decide for an access policy,
	// so we make the decision here.
	if authlib.IsIdentityType(requester.GetIdentityType(), authlib.TypeAccessPolicy) {
		return authorizeTokenPermissions(requester, attr)
	}

	if !policy.clusterScoped {
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

// authorizeTokenPermissions checks the verb storage would check, so list and
// watch need get, patch needs update and deletecollection needs delete. A
// subresource needs the permission on its parent, since service permissions
// cannot name a subresource.
func authorizeTokenPermissions(requester authlib.AuthInfo, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	verb, ok := rbac.ActionVerb(attr.GetVerb())
	if !ok {
		return authorizer.DecisionDeny, fmt.Sprintf("verb %q cannot be granted to an access policy", attr.GetVerb()), nil
	}
	if authzlib.CheckServicePermissions(requester, attr.GetAPIGroup(), attr.GetResource(), verb).Allowed {
		return authorizer.DecisionAllow, "", nil
	}
	return authorizer.DecisionDeny, fmt.Sprintf("access policy does not grant %s/%s:%s", attr.GetAPIGroup(), attr.GetResource(), verb), nil
}
