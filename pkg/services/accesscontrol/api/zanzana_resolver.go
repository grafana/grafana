package api

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	claims "github.com/grafana/authlib/types"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/services/user"
)

// zanzanaPermissionResolver handles resolving user permissions using Zanzana
type zanzanaPermissionResolver struct {
	client  zanzana.Client
	userSvc user.Service
}

func newZanzanaPermissionResolver(client zanzana.Client, userSvc user.Service) *zanzanaPermissionResolver {
	return &zanzanaPermissionResolver{
		client:  client,
		userSvc: userSvc,
	}
}

// resolveCurrentUserPermissions lists Zanzana-supported permissions for the signed-in identity.
func (r *zanzanaPermissionResolver) resolveCurrentUserPermissions(ctx context.Context, usr identity.Requester) ([]ac.Permission, error) {
	subject := usr.GetUID()
	namespace := claims.OrgNamespaceFormatter(usr.GetOrgID())
	return r.listAllWithPrefix(ctx, namespace, subject, "", "")
}

// searchUsersPermissions searches for users' permissions using Zanzana
func (r *zanzanaPermissionResolver) searchUsersPermissions(ctx context.Context, signedInUser identity.Requester, orgID int64, options ac.SearchOptions) (map[int64][]ac.Permission, error) {
	// If we have a specific user ID, search for that user
	if options.UserID > 0 {
		return r.searchSingleUser(ctx, orgID, options.UserID, options)
	}

	// Otherwise, we need to search across all users with the given action
	return r.searchAllUsers(ctx, signedInUser, orgID, options)
}

// searchSingleUser searches permissions for a single user.
func (r *zanzanaPermissionResolver) searchSingleUser(ctx context.Context, orgID, userID int64, options ac.SearchOptions) (map[int64][]ac.Permission, error) {
	usr, err := r.userSvc.GetByID(ctx, &user.GetUserByIDQuery{ID: userID})
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return r.searchPermissionsForIdentity(ctx, orgID, userID, usr.UID, usr.IsServiceAccount, options)
}

// searchPermissionsForIdentity resolves permissions when uid and account type are already known.
// Used by searchAllUsers with data from user.Search (avoids one GetByID per user). Search results
// only include non-service accounts; pass isServiceAccount accordingly for other call sites.
func (r *zanzanaPermissionResolver) searchPermissionsForIdentity(ctx context.Context, orgID, userID int64, uid string, isServiceAccount bool, options ac.SearchOptions) (map[int64][]ac.Permission, error) {
	result := make(map[int64][]ac.Permission)
	permissions := []ac.Permission{}

	var subject string
	if isServiceAccount {
		subject = claims.NewTypeID(claims.TypeServiceAccount, uid)
	} else {
		subject = claims.NewTypeID(claims.TypeUser, uid)
	}

	namespace := claims.OrgNamespaceFormatter(orgID)

	var err error
	if options.Action != "" {
		group, resource, verb := common.TranslateActionToListParams(options.Action)
		if group != "" && resource != "" {
			perms, err := r.listPermissions(ctx, namespace, subject, group, resource, verb, options.Action, options.Scope)
			if err != nil {
				return nil, err
			}
			permissions = append(permissions, perms...)
		}
	} else if options.ActionPrefix != "" {
		permissions, err = r.listAllWithPrefix(ctx, namespace, subject, options.ActionPrefix, options.Scope)
		if err != nil {
			return nil, err
		}
	} else {
		// Neither action nor prefix specified (namespacedId-only query): list every supported action.
		permissions, err = r.listAllWithPrefix(ctx, namespace, subject, "", options.Scope)
		if err != nil {
			return nil, err
		}
	}

	if len(permissions) > 0 {
		result[userID] = permissions
	}

	return result, nil
}

// searchAllUsers searches permissions across all users for a given action
func (r *zanzanaPermissionResolver) searchAllUsers(ctx context.Context, signedInUser identity.Requester, orgID int64, options ac.SearchOptions) (map[int64][]ac.Permission, error) {
	result := make(map[int64][]ac.Permission)

	if options.Action == "" && options.ActionPrefix == "" {
		return result, nil
	}

	// Keep the same semantics as the legacy endpoint and iterate over all pages.
	const usersPageSize = 500
	const maxConcurrentRequests = 16
	page := 1
	for {
		searchQuery := &user.SearchUsersQuery{
			SignedInUser: signedInUser,
			OrgID:        orgID,
			Query:        "",
			Page:         page,
			Limit:        usersPageSize,
		}
		searchResult, err := r.userSvc.Search(ctx, searchQuery)
		if err != nil {
			return nil, fmt.Errorf("failed to search users: %w", err)
		}
		if len(searchResult.Users) == 0 {
			break
		}

		var mu sync.Mutex
		g, gctx := errgroup.WithContext(ctx)
		g.SetLimit(maxConcurrentRequests)
		for _, userHit := range searchResult.Users {
			userHit := userHit
			g.Go(func() error {
				var userPerms map[int64][]ac.Permission
				var err error
				// user.Search already returns id and uid; org user search excludes service accounts.
				if userHit.UID != "" {
					userPerms, err = r.searchPermissionsForIdentity(gctx, orgID, userHit.ID, userHit.UID, false, options)
				} else {
					userPerms, err = r.searchSingleUser(gctx, orgID, userHit.ID, options)
				}
				if err != nil {
					if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
						return err
					}
					logger.Warn("failed to resolve zanzana permissions for user", "userID", userHit.ID, "error", err)
					return nil
				}

				if len(userPerms) > 0 {
					mu.Lock()
					for uid, perms := range userPerms {
						if len(perms) > 0 {
							result[uid] = perms
						}
					}
					mu.Unlock()
				}
				return nil
			})
		}
		if err := g.Wait(); err != nil {
			return nil, err
		}

		if len(searchResult.Users) < usersPageSize {
			break
		}
		page++
		if int64((page-1)*usersPageSize) >= searchResult.TotalCount {
			break
		}
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
	}

	return result, nil
}

func scopeFromAction(action, name string) string {
	parts := strings.SplitN(action, ":", 2)
	if parts[0] == "" {
		return name
	}
	return ac.Scope(parts[0], "uid", name)
}

func allScopeFromAction(action string) string {
	parts := strings.SplitN(action, ":", 2)
	if parts[0] == "" {
		return "*"
	}
	return ac.Scope(parts[0], "*")
}

// folderScopeForLegacyRBAC returns a legacy RBAC scope for folder-scoped access (folders:uid:<uid>).
func folderScopeForLegacyRBAC(folderUID string) string {
	return ac.Scope("folders", "uid", folderUID)
}

// isDashboardRBACAction matches actions backed by the dashboard generic list path, which returns
// both direct dashboard objects (Items) and enclosing folders (Folders).
func isDashboardRBACAction(action string) bool {
	return strings.HasPrefix(action, "dashboards:")
}

// listPermissions lists permissions for a subject on a given group/resource
func (r *zanzanaPermissionResolver) listPermissions(ctx context.Context, namespace, subject, group, resource, verb, action, scope string) ([]ac.Permission, error) {
	req := &authzv1.ListRequest{
		Namespace: namespace,
		Subject:   subject,
		Group:     group,
		Verb:      verb,
		Resource:  resource,
	}

	resp, err := r.client.List(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("zanzana list failed: %w", err)
	}

	permissions := []ac.Permission{}

	// Build the set of scopes that satisfy the filter: the exact scope plus
	// every wildcard that encompasses it (mirrors legacy RBAC semantics).
	// e.g. scope "folders:uid:abc" matches "folders:uid:abc", "folders:uid:*", "folders:*", "*".
	var scopeSet map[string]struct{}
	if scope != "" {
		wildcards := ac.WildcardsFromPrefix(ac.ScopePrefix(scope))
		scopeSet = make(map[string]struct{}, len(wildcards)+1)
		scopeSet[scope] = struct{}{}
		for _, w := range wildcards {
			scopeSet[w] = struct{}{}
		}
	}

	appendIfMatches := func(p ac.Permission) {
		if scope == "" {
			permissions = append(permissions, p)
			return
		}
		if _, ok := scopeSet[p.Scope]; ok {
			permissions = append(permissions, p)
		}
	}

	// If All is true, the user has access to all resources of this type.
	if resp.All {
		if isDashboardRBACAction(action) {
			// Legacy RBAC sometimes stores scope "*" for org-wide dashboard access. Only add it
			// when there is no scope filter: with a non-empty filter, "*" would match queries where
			// legacy rows only had dashboards:* / folders:* (see PermissionMatchesSearchOptions).
			if scope == "" {
				appendIfMatches(ac.Permission{
					Action: action,
					Scope:  "*",
				})
			}
			appendIfMatches(ac.Permission{
				Action: action,
				Scope:  allScopeFromAction(action),
			})
			// Generic dashboard list grants org-wide dashboard access; legacy RBAC also records
			// folder wildcard for the same action (see SearchUsersPermissions / Reduce).
			appendIfMatches(ac.Permission{
				Action: action,
				Scope:  ac.Scope("folders", "*"),
			})
		} else {
			appendIfMatches(ac.Permission{
				Action: action,
				Scope:  allScopeFromAction(action),
			})
		}
	}

	// Convert Items to legacy scopes (e.g. dashboards:uid:<name>).
	for _, item := range resp.Items {
		appendIfMatches(ac.Permission{
			Action: action,
			Scope:  scopeFromAction(action, item),
		})
	}

	// listGeneric on the Zanzana server returns folder UIDs separately; map them to folders:uid:*
	// scopes so they match legacy RBAC (not dashboards:uid:<folderUID>).
	for _, folderUID := range resp.Folders {
		appendIfMatches(ac.Permission{
			Action: action,
			Scope:  folderScopeForLegacyRBAC(folderUID),
		})
	}

	return permissions, nil
}

func (r *zanzanaPermissionResolver) listAllWithPrefix(ctx context.Context, namespace, subject, prefix, scope string) ([]ac.Permission, error) {
	var permissions []ac.Permission
	for _, entry := range common.SupportedActions() {
		if strings.HasPrefix(entry.Action, prefix) {
			perms, err := r.listPermissions(ctx, namespace, subject, entry.Group, entry.Resource, entry.Verb, entry.Action, scope)
			if err != nil {
				return nil, err
			}
			permissions = append(permissions, perms...)
		}
	}
	return permissions, nil
}
