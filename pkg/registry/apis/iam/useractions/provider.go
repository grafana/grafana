package useractions

import (
	"context"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	authzstore "github.com/grafana/grafana/pkg/services/authz/rbac/store"
)

// teamPageSize bounds each page of the team lookup.
const teamPageSize = 50

// Options mirrors the legacy endpoint's reloadcache behaviour.
type Options struct {
	// ReloadCache resolves permissions afresh instead of serving a cached set.
	ReloadCache bool
}

// RolePermissionProvider resolves the RBAC actions granted to the caller.
type RolePermissionProvider interface {
	ActionsForUser(ctx context.Context, requester identity.Requester, opts Options) (map[string]bool, error)
}

// identityStore resolves the teams an identity belongs to.
type identityStore interface {
	ListUserTeams(ctx context.Context, ns claims.NamespaceInfo, query legacy.ListUserTeamsQuery) (*legacy.ListUserTeamsResult, error)
}

// identifierStore resolves an identity's internal id and its basic role.
type identifierStore interface {
	GetUserIdentifiers(ctx context.Context, query authzstore.UserIdentifierQuery) (*authzstore.UserIdentifiers, error)
	GetBasicRoles(ctx context.Context, ns claims.NamespaceInfo, query authzstore.BasicRoleQuery) (*authzstore.BasicRole, error)
}

type sqlProvider struct {
	actions        ActionStore
	identifiers    identifierStore
	identities     identityStore
	actionResolver accesscontrol.ActionResolver
}

// NewSQLProvider resolves actions from the RBAC tables, keyed off the request
// namespace so it serves both single- and multi-tenant deployments. It covers
// the caller's basic role, Grafana Admin for server admins, and roles assigned
// to the user and its teams. actionResolver expands action sets and may be nil
// where none are registered, in which case action sets are reported as-is.
func NewSQLProvider(actions ActionStore, identifiers identifierStore, identities identityStore, actionResolver accesscontrol.ActionResolver) RolePermissionProvider {
	return &sqlProvider{
		actions:        actions,
		identifiers:    identifiers,
		identities:     identities,
		actionResolver: actionResolver,
	}
}

func (p *sqlProvider) ActionsForUser(ctx context.Context, requester identity.Requester, _ Options) (map[string]bool, error) {
	// Only users and service accounts hold RBAC assignments.
	if !requester.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("cannot resolve actions for a %s identity", requester.GetIdentityType()))
	}

	// The request namespace is the tenant the caller asked about, is already
	// checked by the namespace authorizer, and is what the org id came from.
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	ids, err := p.identifiers.GetUserIdentifiers(ctx, authzstore.UserIdentifierQuery{UserUID: requester.GetIdentifier()})
	if err != nil {
		return nil, notFoundOrErr(err, requester.GetIdentifier(), "could not resolve identity")
	}

	basicRole, err := p.identifiers.GetBasicRoles(ctx, ns, authzstore.BasicRoleQuery{UserID: ids.ID})
	if err != nil {
		return nil, notFoundOrErr(err, ids.UID, "could not resolve basic role")
	}

	teamIDs, err := p.userTeams(ctx, ns, ids.UID)
	if err != nil {
		return nil, err
	}

	actions, err := p.actions.GetUserActions(ctx, ns, ActionsQuery{
		UserID:        ids.ID,
		TeamIDs:       teamIDs,
		Role:          basicRole.Role,
		IsServerAdmin: basicRole.IsAdmin,
	})
	if err != nil {
		return nil, fmt.Errorf("could not resolve actions: %w", err)
	}

	return p.buildActionMap(actions), nil
}

func (p *sqlProvider) userTeams(ctx context.Context, ns claims.NamespaceInfo, userUID string) ([]int64, error) {
	var teamIDs []int64
	query := legacy.ListUserTeamsQuery{
		UserUID:    userUID,
		Pagination: common.Pagination{Limit: teamPageSize},
	}

	for {
		teams, err := p.identities.ListUserTeams(ctx, ns, query)
		if err != nil {
			return nil, fmt.Errorf("could not resolve teams: %w", err)
		}
		for _, team := range teams.Items {
			teamIDs = append(teamIDs, team.ID)
		}
		if teams.Continue == 0 {
			return teamIDs, nil
		}
		query.Pagination.Continue = teams.Continue
	}
}

// buildActionMap expands action sets when a resolver is configured.
func (p *sqlProvider) buildActionMap(actions []string) map[string]bool {
	if p.actionResolver == nil {
		out := make(map[string]bool, len(actions))
		for _, action := range actions {
			out[action] = true
		}
		return out
	}

	permissions := make([]accesscontrol.Permission, 0, len(actions))
	for _, action := range actions {
		permissions = append(permissions, accesscontrol.Permission{Action: action})
	}
	return accesscontrol.BuildPermissionsMap(p.actionResolver.ExpandActionSets(permissions))
}

// notFoundOrErr turns "the identity has no row in this tenant" into a 404. It is
// a normal outcome for a token that authenticates for a stack the user is not a
// member of, and would otherwise surface as a 500.
func notFoundOrErr(err error, name, context string) error {
	if errors.Is(err, authzstore.ErrUserNotFound) || errors.Is(err, authzstore.ErrBasicRoleNotFound) {
		return apierrors.NewNotFound(schema.GroupResource{Group: "iam.grafana.app", Resource: "users"}, name)
	}
	return fmt.Errorf("%s: %w", context, err)
}
