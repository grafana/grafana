package legacy

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

// ScopeResolverStore is the minimal identity-lookup interface needed by the
// scope resolution helpers. LegacyIdentityStore satisfies it.
type ScopeResolverStore interface {
	GetTeamInternalID(ctx context.Context, ns claims.NamespaceInfo, query GetTeamInternalIDQuery) (*GetTeamInternalIDResult, error)
	GetUserInternalID(ctx context.Context, ns claims.NamespaceInfo, query GetUserInternalIDQuery) (*GetUserInternalIDResult, error)
	GetServiceAccountInternalID(ctx context.Context, ns claims.NamespaceInfo, query GetServiceAccountInternalIDQuery) (*GetServiceAccountInternalIDResult, error)
	GetTeamUIDByID(ctx context.Context, ns claims.NamespaceInfo, query GetTeamUIDByIDQuery) (*GetTeamUIDByIDResult, error)
	GetUserUIDByID(ctx context.Context, ns claims.NamespaceInfo, query GetUserUIDByIDQuery) (*GetUserUIDByIDResult, error)
	GetServiceAccountUIDByID(ctx context.Context, ns claims.NamespaceInfo, query GetUserUIDByIDQuery) (*GetUserUIDByIDResult, error)
}

// ResolveUIDScopeForWrite converts a single uid-based scope (teams:uid:xxx, users:uid:xxx,
// serviceaccounts:uid:xxx) to its id-based equivalent (teams:id:123, etc.).
// Wildcard scopes (e.g. teams:uid:*) are rewritten without a lookup.
// Returns the scope unchanged if it doesn't match a known uid prefix.
func ResolveUIDScopeForWrite(ctx context.Context, store ScopeResolverStore, ns claims.NamespaceInfo, scope string) (string, error) {
	switch {
	case strings.HasPrefix(scope, "teams:uid:"):
		uid := strings.TrimPrefix(scope, "teams:uid:")
		if uid == "*" {
			return "teams:id:*", nil
		}
		result, err := store.GetTeamInternalID(ctx, ns, GetTeamInternalIDQuery{UID: uid})
		if err != nil {
			return "", fmt.Errorf("resolving team uid %q to internal id: %w", uid, err)
		}
		return fmt.Sprintf("teams:id:%d", result.ID), nil
	case strings.HasPrefix(scope, "users:uid:"):
		uid := strings.TrimPrefix(scope, "users:uid:")
		if uid == "*" {
			return "users:id:*", nil
		}
		result, err := store.GetUserInternalID(ctx, ns, GetUserInternalIDQuery{UID: uid})
		if err != nil {
			return "", fmt.Errorf("resolving user uid %q to internal id: %w", uid, err)
		}
		return fmt.Sprintf("users:id:%d", result.ID), nil
	case strings.HasPrefix(scope, "serviceaccounts:uid:"):
		uid := strings.TrimPrefix(scope, "serviceaccounts:uid:")
		if uid == "*" {
			return "serviceaccounts:id:*", nil
		}
		result, err := store.GetServiceAccountInternalID(ctx, ns, GetServiceAccountInternalIDQuery{UID: uid})
		if err != nil {
			return "", fmt.Errorf("resolving service account uid %q to internal id: %w", uid, err)
		}
		return fmt.Sprintf("serviceaccounts:id:%d", result.ID), nil
	default:
		return scope, nil
	}
}

// ResolveUIDScopesForWrite is the batch version of ResolveUIDScopeForWrite.
// The returned slice is always a copy; the input is never mutated.
func ResolveUIDScopesForWrite(ctx context.Context, store ScopeResolverStore, ns claims.NamespaceInfo, permissions []accesscontrol.Permission) ([]accesscontrol.Permission, error) {
	out := make([]accesscontrol.Permission, len(permissions))
	copy(out, permissions)
	for i, p := range out {
		resolved, err := ResolveUIDScopeForWrite(ctx, store, ns, p.Scope)
		if err != nil {
			return nil, err
		}
		if resolved != p.Scope {
			out[i].Scope = resolved
			out[i].Kind, out[i].Attribute, out[i].Identifier = accesscontrol.SplitScope(resolved)
		}
	}
	return out, nil
}

// ResolveUIDScopesForRead is the read-path equivalent of ResolveUIDScopesForWrite.
// Orphaned permissions (referencing deleted entities) are omitted with a warning
// instead of causing an error, so read responses stay stable.
func ResolveUIDScopesForRead(ctx context.Context, store ScopeResolverStore, ns claims.NamespaceInfo, permissions []accesscontrol.Permission, logger log.Logger) ([]accesscontrol.Permission, error) {
	out := make([]accesscontrol.Permission, 0, len(permissions))
	for _, p := range permissions {
		resolved, err := ResolveUIDScopeForWrite(ctx, store, ns, p.Scope)
		if err != nil {
			if IsNotFoundError(err) {
				logger.Warn("Omitting permission with orphaned uid scope", "scope", p.Scope)
				continue
			}
			return nil, err
		}
		if resolved != p.Scope {
			p.Scope = resolved
			p.Kind, p.Attribute, p.Identifier = accesscontrol.SplitScope(resolved)
		}
		out = append(out, p)
	}
	return out, nil
}

// ResolveIDScopeToUIDName resolves an id-based scope to just the uid name.
// e.g. "teams:id:1" → "teamuid1". Returns an error if the entity is not found
// or the scope doesn't match a known id prefix.
func ResolveIDScopeToUIDName(ctx context.Context, store ScopeResolverStore, ns claims.NamespaceInfo, scope string) (string, error) {
	parts := strings.SplitN(scope, ":", 3)
	if len(parts) != 3 {
		return "", fmt.Errorf("invalid scope: %s", scope)
	}
	id, err := strconv.ParseInt(parts[2], 10, 64)
	if err != nil {
		return "", fmt.Errorf("invalid id in scope %s: %w", scope, err)
	}
	switch parts[0] {
	case "teams":
		result, err := store.GetTeamUIDByID(ctx, ns, GetTeamUIDByIDQuery{ID: id})
		if err != nil {
			return "", fmt.Errorf("resolving team id %d to uid: %w", id, err)
		}
		return result.UID, nil
	case "users":
		result, err := store.GetUserUIDByID(ctx, ns, GetUserUIDByIDQuery{ID: id})
		if err != nil {
			return "", fmt.Errorf("resolving user id %d to uid: %w", id, err)
		}
		return result.UID, nil
	case "serviceaccounts":
		result, err := store.GetServiceAccountUIDByID(ctx, ns, GetUserUIDByIDQuery{ID: id})
		if err != nil {
			return "", fmt.Errorf("resolving service account id %d to uid: %w", id, err)
		}
		return result.UID, nil
	default:
		return "", fmt.Errorf("unknown id-scoped resource: %s", parts[0])
	}
}

// ResolveIDScopeToUID resolves a single id-based scope (teams:id:123, users:id:123,
// serviceaccounts:id:123) to its uid-based equivalent. Wildcard scopes are converted
// without a lookup. If the entity is not found the permission should be omitted
// (drop=true) — teams/users/service accounts clean up their permissions on delete,
// so this is a safety net for stale data. Non-not-found errors are returned so the
// caller can decide whether to fail.
func ResolveIDScopeToUID(ctx context.Context, store ScopeResolverStore, ns claims.NamespaceInfo, scope string, logger log.Logger) (resolved string, drop bool, err error) {
	switch {
	case strings.HasPrefix(scope, "teams:id:"):
		idStr := strings.TrimPrefix(scope, "teams:id:")
		if idStr == "*" {
			return "teams:uid:*", false, nil
		}
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			return scope, false, nil
		}
		result, err := store.GetTeamUIDByID(ctx, ns, GetTeamUIDByIDQuery{ID: id})
		if err != nil {
			if IsNotFoundError(err) {
				logger.Warn("Omitting permission with orphaned team scope", "scope", scope)
				return "", true, nil
			}
			return "", false, fmt.Errorf("resolving team id %s to uid: %w", idStr, err)
		}
		return "teams:uid:" + result.UID, false, nil

	case strings.HasPrefix(scope, "users:id:"):
		idStr := strings.TrimPrefix(scope, "users:id:")
		if idStr == "*" {
			return "users:uid:*", false, nil
		}
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			return scope, false, nil
		}
		result, err := store.GetUserUIDByID(ctx, ns, GetUserUIDByIDQuery{ID: id})
		if err != nil {
			if IsNotFoundError(err) {
				logger.Warn("Omitting permission with orphaned user scope", "scope", scope)
				return "", true, nil
			}
			return "", false, fmt.Errorf("resolving user id %s to uid: %w", idStr, err)
		}
		return "users:uid:" + result.UID, false, nil

	case strings.HasPrefix(scope, "serviceaccounts:id:"):
		idStr := strings.TrimPrefix(scope, "serviceaccounts:id:")
		if idStr == "*" {
			return "serviceaccounts:uid:*", false, nil
		}
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			return scope, false, nil
		}
		result, err := store.GetServiceAccountUIDByID(ctx, ns, GetUserUIDByIDQuery{ID: id})
		if err != nil {
			if IsNotFoundError(err) {
				logger.Warn("Omitting permission with orphaned service account scope", "scope", scope)
				return "", true, nil
			}
			return "", false, fmt.Errorf("resolving service account id %s to uid: %w", idStr, err)
		}
		return "serviceaccounts:uid:" + result.UID, false, nil

	default:
		return scope, false, nil
	}
}

// ResolveIDScopesToUID converts id-based scopes to uid-based scopes for a slice
// of permissions. Permissions referencing deleted entities are silently omitted
// (with a warning log). This should not happen because parents are expected to clean
// up permissions on delete. The returned slice is always a new allocation.
func ResolveIDScopesToUID(
	ctx context.Context,
	store ScopeResolverStore,
	ns claims.NamespaceInfo,
	perms []accesscontrol.Permission,
	logger log.Logger,
) ([]accesscontrol.Permission, error) {
	out := make([]accesscontrol.Permission, 0, len(perms))
	for _, p := range perms {
		resolved, drop, err := ResolveIDScopeToUID(ctx, store, ns, p.Scope, logger)
		if err != nil {
			return nil, err
		}
		if drop {
			continue
		}
		p.Scope = resolved
		p.Kind, p.Attribute, p.Identifier = accesscontrol.SplitScope(resolved)
		out = append(out, p)
	}
	return out, nil
}

// ResolveIDScopesToUIDStrict is the write-path variant of ResolveIDScopesToUID.
// It returns an error when an id-based scope references a deleted entity instead
// of silently omitting it, so the caller can reject the request.
func ResolveIDScopesToUIDStrict(
	ctx context.Context,
	store ScopeResolverStore,
	ns claims.NamespaceInfo,
	perms []accesscontrol.Permission,
	logger log.Logger,
) ([]accesscontrol.Permission, error) {
	out := make([]accesscontrol.Permission, 0, len(perms))
	for _, p := range perms {
		resolved, drop, err := ResolveIDScopeToUID(ctx, store, ns, p.Scope, logger)
		if err != nil {
			return nil, err
		}
		if drop {
			return nil, fmt.Errorf("scope %q references a deleted entity", p.Scope)
		}
		p.Scope = resolved
		p.Kind, p.Attribute, p.Identifier = accesscontrol.SplitScope(resolved)
		out = append(out, p)
	}
	return out, nil
}

func IsNotFoundError(err error) bool {
	return errors.Is(err, user.ErrUserNotFound) || errors.Is(err, team.ErrTeamNotFound) || errors.Is(err, serviceaccounts.ErrServiceAccountNotFound)
}
