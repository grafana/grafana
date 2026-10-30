package legacyscopes

import (
	"context"
	"strconv"
	"strings"

	"github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

type ScopeReference struct {
	Resource  string
	Attribute string
	Value     string
}

type ScopeResolver interface {
	ResolveScope(context.Context, types.NamespaceInfo, ScopeReference) (string, error)
}

var aliasLogger = log.New("accesscontrol.scope_aliases")

// WithAliases adds equivalent identity scopes without persisting additional grants.
// Lookup failures retain the source grant; cancellation aborts the complete result.
func WithAliases(ctx context.Context, namespace, scope string, resolver ScopeResolver, permissions []ac.Permission) ([]ac.Permission, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	resolver, err := prepareScopeAliases(ctx, namespace, resolver, permissions)
	if err != nil {
		return nil, err
	}
	seen := make(map[[2]string]bool)
	var result []ac.Permission
	appendPermission := func(p ac.Permission) {
		if scope != "" && p.Scope != scope && !ac.WildcardsFromPrefix(ac.ScopePrefix(scope)).Contains(p.Scope) {
			return
		}
		key := [2]string{p.Action, p.Scope}
		if !seen[key] {
			seen[key] = true
			result = append(result, p)
		}
	}
	resolved := make(map[ScopeReference]string)
	for _, p := range permissions {
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		kind, ref, identity := identityReference(p.Scope)
		if identity && ref.Attribute == "id" && ref.Value != "*" && !validNumericID(ref.Value) {
			continue
		}
		appendPermission(p)
		if !identity {
			continue
		}
		other := "id"
		if ref.Attribute == "id" {
			other = "uid"
		}
		alias, err := resolveAlias(ctx, namespace, resolver, ref, resolved)
		if err != nil {
			return nil, err
		}
		if alias == "" || (ref.Value != "*" && (strings.ContainsAny(alias, "*?") || (other == "id" && !validNumericID(alias)))) {
			continue
		}

		appendPermission(ac.Permission{Action: p.Action, Scope: ac.Scope(kind, other, alias), DatasourceType: p.DatasourceType})
	}
	return result, ctx.Err()
}

func identityReference(scope string) (string, ScopeReference, bool) {
	kind, attr, value := ac.SplitScope(scope)
	resource := kind
	if resource == "global.users" {
		resource = "users"
	}
	identity := resource == "users" || resource == "teams" || resource == "serviceaccounts"
	return kind, ScopeReference{Resource: resource, Attribute: attr, Value: value}, identity && (attr == "id" || attr == "uid")
}

func validNumericID(value string) bool {
	id, err := strconv.ParseInt(value, 10, 64)
	return err == nil && id > 0
}

func resolveAlias(ctx context.Context, namespace string, resolver ScopeResolver, ref ScopeReference, resolved map[ScopeReference]string) (string, error) {
	if ref.Value == "*" {
		return "*", nil
	}
	if resolver == nil || ref.Value == "" || strings.ContainsAny(ref.Value, "*?") {
		return "", nil
	}
	if alias, ok := resolved[ref]; ok {
		return alias, nil
	}
	ns, err := types.ParseNamespace(namespace)
	if err != nil {
		return "", err
	}
	alias, err := resolver.ResolveScope(ctx, ns, ref)
	if err != nil {
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		aliasLogger.Warn("could not resolve permission scope alias", "resource", ref.Resource, "attribute", ref.Attribute, "value", ref.Value, "error", err)
		alias = ""
	}
	resolved[ref] = alias
	return alias, nil
}

// ResolveUserScopes is shared by embedded AuthZ and the local permission loaders.
func ResolveUserScopes(ctx context.Context, user identity.Requester, resolver ScopeResolver, permissions []ac.Permission) ([]ac.Permission, error) {
	if resolver == nil {
		return permissions, ctx.Err()
	}
	namespace := permissionNamespace(ctx, user)
	return WithAliases(ctx, namespace, "", resolver, permissions)
}

// LegacySearchScope maps a UID filter to the equivalent numeric filter before
// legacy storage filters rows. Response filtering uses the original scope.
func LegacySearchScope(ctx context.Context, user identity.Requester, resolver ScopeResolver, scope string) (string, error) {
	if resolver == nil || scope == "" {
		return scope, ctx.Err()
	}
	kind, attr, _ := ac.SplitScope(scope)
	if attr != "uid" {
		return scope, ctx.Err()
	}
	permissions, err := ResolveUserScopes(ctx, user, resolver, []ac.Permission{{Scope: scope}})
	if err != nil {
		return "", err
	}
	for _, p := range permissions {
		k, a, _ := ac.SplitScope(p.Scope)
		if k == kind && a == "id" {
			return p.Scope, nil
		}
	}
	return scope, nil
}

func ResolveSearchScopes(ctx context.Context, user identity.Requester, scope string, resolver ScopeResolver, permissions map[int64][]ac.Permission) (map[int64][]ac.Permission, error) {
	if resolver == nil {
		return permissions, ctx.Err()
	}
	namespace := permissionNamespace(ctx, user)
	result := make(map[int64][]ac.Permission, len(permissions))
	for id, perms := range permissions {
		normalized, err := WithAliases(ctx, namespace, scope, resolver, perms)
		if err != nil {
			return nil, err
		}
		if len(normalized) > 0 {
			result[id] = normalized
		}
	}
	return result, nil
}

// Global and missing-membership requesters can retain a legacy namespace sentinel.
// IAM lookups must use the validated transport tenant instead.
func permissionNamespace(ctx context.Context, user identity.Requester) string {
	namespace := user.GetNamespace()
	if namespace != "" && (user.GetOrgID() > 0 || namespace != types.OrgNamespaceFormatter(user.GetOrgID())) {
		return namespace
	}
	if namespace, ok := request.NamespaceFrom(ctx); ok && namespace != "" {
		return namespace
	}
	if caller, ok := types.AuthInfoFrom(ctx); ok {
		if ns, err := types.ParseNamespace(caller.GetNamespace()); err == nil && ns.OrgID > 0 {
			return ns.Value
		}
	}
	orgID := user.GetOrgID()
	if orgID < 1 {
		orgID = 1
	}
	return types.OrgNamespaceFormatter(orgID)
}

func prepareScopeAliases(ctx context.Context, namespace string, resolver ScopeResolver, permissions []ac.Permission) (ScopeResolver, error) {
	if preparer, ok := resolver.(ScopeAliasPreparer); ok {
		var refs []ScopeReference
		for _, p := range permissions {
			_, ref, identity := identityReference(p.Scope)
			if identity && ref.Value != "" && !strings.ContainsAny(ref.Value, "*?") && (ref.Attribute != "id" || validNumericID(ref.Value)) {
				refs = append(refs, ref)
			}
		}
		if len(refs) > 0 {
			ns, err := types.ParseNamespace(namespace)
			if err != nil {
				return nil, err
			}
			prepared, err := preparer.PrepareScopes(ctx, ns, refs)
			if err != nil {
				if ctx.Err() != nil {
					return nil, ctx.Err()
				}
				aliasLogger.Warn("could not prepare permission scope aliases; retaining source scopes", "error", err)
				return nil, nil
			} else {
				return prepared, nil
			}
		}
	}
	return resolver, nil
}
