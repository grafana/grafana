package sync

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patscope"
)

// PersonalTokenScopeHook narrows the permissions of token-authenticated identities
// to owner permissions ∩ token scopes. It must run after permissions are synced.
type PersonalTokenScopeHook struct {
	allowAdminActions func() bool
}

func ProvidePersonalTokenScopeHook(allowAdminActions func() bool) *PersonalTokenScopeHook {
	return &PersonalTokenScopeHook{allowAdminActions: allowAdminActions}
}

func (h *PersonalTokenScopeHook) Hook(_ context.Context, ident *authn.Identity, _ *authn.Request) error {
	if ident.PersonalTokenID == 0 {
		return nil
	}
	// Fail closed: a token identity without synced permissions gets none.
	owner := ident.Permissions[ident.OrgID]
	ident.Permissions = map[int64]map[string][]string{
		ident.OrgID: patscope.Effective(owner, ident.PersonalTokenScopes, h.allowAdminActions()),
	}
	ident.PersonalTokenResourceScoped = patscope.IsResourceScoped(ident.PersonalTokenScopes)
	// Role-gated routes (reqOrgAdmin, reqGrafanaAdmin) bypass RBAC actions, so the
	// owner's admin role and server-admin flag never leak into the token identity,
	// not even when admin actions are allowed: a single admin scope must not turn the
	// token into the owner. The role is lowered to Viewer (Editor when the token holds
	// write actions) rather than None: the in-process Kubernetes-style API checks the
	// org role for the loopback calls the legacy handlers make.
	admin := false
	ident.IsGrafanaAdmin = &admin
	ident.OrgRoles = map[int64]org.RoleType{ident.OrgID: tokenOrgRole(ident.OrgRoles[ident.OrgID], ident.Permissions[ident.OrgID])}
	return nil
}

func tokenOrgRole(ownerRole org.RoleType, perms map[string][]string) org.RoleType {
	if ownerRole == "" || ownerRole == org.RoleNone {
		return org.RoleNone
	}
	role := org.RoleViewer
	for action := range perms {
		if strings.HasSuffix(action, ":write") || strings.HasSuffix(action, ":create") || strings.HasSuffix(action, ":delete") {
			role = org.RoleEditor
			break
		}
	}
	if ownerRole == org.RoleViewer {
		return org.RoleViewer
	}
	return role
}
