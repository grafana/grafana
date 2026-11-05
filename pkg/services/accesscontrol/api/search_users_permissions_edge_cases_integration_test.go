package api_test

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestIntegrationSearchUsersPermissions_TargetAuthorization(t *testing.T) {
	for _, mode := range []struct {
		name string
		grpc bool
	}{{"legacy", false}, {"grpc", true}} {
		t.Run(mode.name, func(t *testing.T) { testIntegrationSearchUsersPermissions_TargetAuthorization(t, mode.grpc) })
	}
}

func testIntegrationSearchUsersPermissions_TargetAuthorization(t *testing.T, useGRPC bool) {
	f := newSearchPermissionsFixture(t, useGRPC)
	usr := f.createUser(t, user.CreateUserCommand{UID: "target", OrgID: f.orgID, DefaultOrgRole: "None"})
	role := f.createRole(t, f.orgID, "managed:target", []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:one"}})
	f.assignUser(t, f.orgID, usr.ID, role)
	for _, id := range []string{fmt.Sprint(usr.ID), usr.UID} {
		for _, filter := range []string{"", "&action=test:read", "&actionPrefix=test:"} {
			t.Run(id+filter, func(t *testing.T) {
				query := "namespacedId=user:" + id + filter
				want := searchPermissionsResponse{usr.ID: {"test:read": {"tests:id:one"}}}
				f.assertSearch(t, f.caller(f.orgID, "users:*"), query, want)
				scoped := f.caller(f.orgID, fmt.Sprintf("users:id:%d", usr.ID))
				f.assertSearch(t, scoped, query, want)
				f.assertSearch(t, f.caller(f.orgID, fmt.Sprintf("global.users:id:%d", usr.ID)), query, want)
				for _, permissions := range []map[int64]map[string][]string{
					{}, {f.orgID: {"test:read": {"*"}}},
					{f.otherOrgID: {accesscontrol.ActionUsersPermissionsRead: {"users:*"}}},
				} {
					status, body := f.request(t, &user.SignedInUser{UserID: 1002, OrgID: f.orgID, Permissions: permissions}, query)
					require.Equal(t, http.StatusForbidden, status, string(body))
				}
			})
		}
	}
}

func TestIntegrationSearchUsersPermissions_NonPositiveTargetsWithFilters(t *testing.T) {
	for _, mode := range []struct {
		name string
		grpc bool
	}{{"legacy", false}, {"grpc", true}} {
		t.Run(mode.name, func(t *testing.T) { testIntegrationSearchUsersPermissions_NonPositiveTargetsWithFilters(t, mode.grpc) })
	}
}

func testIntegrationSearchUsersPermissions_NonPositiveTargetsWithFilters(t *testing.T, useGRPC bool) {
	f := newSearchPermissionsFixture(t, useGRPC)
	want := searchPermissionsResponse{}
	for _, uid := range []string{"alice", "bob"} {
		usr := f.createUser(t, user.CreateUserCommand{UID: uid, OrgID: f.orgID, DefaultOrgRole: "None"})
		role := f.createRole(t, f.orgID, "managed:"+uid, []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:one"}})
		f.assignUser(t, f.orgID, usr.ID, role)
		want[usr.ID] = map[string][]string{"test:read": {"tests:id:one"}}
	}
	// Non-positive IDs currently select the broad search path when an action filter is present.
	for _, typ := range []string{"user", "service-account"} {
		for _, id := range []string{"0", "-1"} {
			for _, filter := range []string{"action=test:read", "actionPrefix=test:"} {
				t.Run(typ+id+filter, func(t *testing.T) {
					f.assertSearch(t, f.caller(f.orgID, "users:*"), "namespacedId="+typ+":"+id+"&"+filter, want)
				})
			}
		}
	}
}

func TestIntegrationSearchUsersPermissions_UnfilteredActionSets(t *testing.T) {
	for _, mode := range []struct {
		name string
		grpc bool
	}{{"legacy", false}, {"grpc", true}} {
		t.Run(mode.name, func(t *testing.T) { testIntegrationSearchUsersPermissions_UnfilteredActionSets(t, mode.grpc) })
	}
}

func testIntegrationSearchUsersPermissions_UnfilteredActionSets(t *testing.T, useGRPC bool) {
	f := newSearchPermissionsFixture(t, useGRPC)
	usr := f.createUser(t, user.CreateUserCommand{UID: "target", OrgID: f.orgID, DefaultOrgRole: "None"})
	f.actions.StoreActionSet("dashboards:edit", []string{"dashboards:read", "dashboards:write"})
	role := f.createRole(t, f.orgID, "managed:sets", []accesscontrol.Permission{
		{Action: "dashboards:edit", Scope: "dashboards:uid:one"},
		{Action: "dashboards:read", Scope: "dashboards:uid:two"},
	})
	f.assignUser(t, f.orgID, usr.ID, role)
	// Without an action filter the legacy endpoint retains action-set names.
	for _, tt := range []struct {
		name, filter string
		want         map[string][]string
	}{
		{"target only", "", map[string][]string{"dashboards:edit": {"dashboards:uid:one"}, "dashboards:read": {"dashboards:uid:two"}}},
		{"set scope", "&scope=dashboards:uid:one", map[string][]string{"dashboards:edit": {"dashboards:uid:one"}}},
		{"direct scope", "&scope=dashboards:uid:two", map[string][]string{"dashboards:read": {"dashboards:uid:two"}}},
		{"missing scope", "&scope=dashboards:uid:missing", map[string][]string{}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			for range 2 {
				f.assertSearch(t, f.caller(f.orgID, "users:*"), fmt.Sprintf("namespacedId=user:%d%s", usr.ID, tt.filter), searchPermissionsResponse{usr.ID: tt.want})
			}
		})
	}
}

func TestIntegrationSearchUsersPermissions_ActionPrefixCharacters(t *testing.T) {
	for _, mode := range []struct {
		name string
		grpc bool
	}{{"legacy", false}, {"grpc", true}} {
		t.Run(mode.name, func(t *testing.T) { testIntegrationSearchUsersPermissions_ActionPrefixCharacters(t, mode.grpc) })
	}
}

func testIntegrationSearchUsersPermissions_ActionPrefixCharacters(t *testing.T, useGRPC bool) {
	f := newSearchPermissionsFixture(t, useGRPC)
	usr := f.createUser(t, user.CreateUserCommand{UID: "viewer", OrgID: f.orgID, DefaultOrgRole: "Viewer"})
	require.NoError(t, f.service.DeclareFixedRoles(accesscontrol.RoleRegistration{
		Role:   accesscontrol.RoleDTO{Name: "fixed:test:prefix", Permissions: []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:static"}}},
		Grants: []string{string(org.RoleViewer)},
	}))
	require.NoError(t, f.service.RegisterFixedRoles(context.Background()))
	role := f.createRole(t, f.orgID, "managed:prefix", []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:stored"}})
	f.assignUser(t, f.orgID, usr.ID, role)
	caseScopes := []string{"tests:id:stored"}
	// PostgreSQL LIKE is case-sensitive; SQLite and the MySQL test collation are not.
	if db.IsTestDbPostgres() {
		caseScopes = nil
	}
	for _, tt := range []struct {
		name, prefix string
		scopes       []string
	}{
		{"literal prefix", "test:rea", []string{"tests:id:static", "tests:id:stored"}},
		{"different case", "TEST:REA", caseScopes},
		// Stored permissions use SQL LIKE; in-memory permissions use a literal prefix.
		{"SQL percent", "test:rea%", []string{"tests:id:stored"}},
		{"SQL underscore", "test:rea_", []string{"tests:id:stored"}},
		{"asterisk is literal", "test:rea*", nil},
		{"quote is literal", "test:rea'", nil},
	} {
		for _, target := range []string{"", fmt.Sprintf("&namespacedId=user:%d", usr.ID)} {
			t.Run(tt.name+target, func(t *testing.T) {
				want := searchPermissionsResponse{}
				if len(tt.scopes) > 0 {
					want[usr.ID] = map[string][]string{"test:read": tt.scopes}
				} else if target != "" {
					want[usr.ID] = map[string][]string{}
				}
				f.assertSearch(t, f.caller(f.orgID, "users:*"), "actionPrefix="+url.QueryEscape(tt.prefix)+target, want)
			})
		}
	}
}

const (
	grantChange                = "grant"
	revokeChange               = "revoke"
	teamMembershipChange       = "team membership"
	removeTeamMembershipChange = "remove team membership"
	basicRoleChange            = "basic role"
	downgradeBasicRoleChange   = "downgrade basic role"
)

var searchPermissionMutationChanges = []string{
	grantChange, revokeChange, teamMembershipChange, removeTeamMembershipChange, basicRoleChange, downgradeBasicRoleChange,
}

func TestIntegrationSearchUsersPermissions_GRPCMutationVisibility(t *testing.T) {
	for _, change := range searchPermissionMutationChanges {
		t.Run(change, func(t *testing.T) {
			testCase := newSearchPermissionMutationCase(t, true, change)
			testCase.assertSearch(t, testCase.before)
			testCase.mutate(t)
			testCase.assertSearch(t, testCase.after)
		})
	}
}

func TestIntegrationSearchUsersPermissions_LegacyCacheExpiry(t *testing.T) {
	for _, change := range searchPermissionMutationChanges {
		t.Run(change, func(t *testing.T) {
			testCase := newSearchPermissionMutationCase(t, false, change)
			testCase.assertSearch(t, testCase.before)
			calls := testCase.fixture.store.searches.Load()
			require.Positive(t, calls)
			testCase.assertSearch(t, testCase.before)
			require.Equal(t, calls, testCase.fixture.store.searches.Load(), "warm legacy request must avoid a store search")

			testCase.mutate(t)
			// Raw store changes bypass mutation hooks; expiry must still refresh cached results.
			items := testCase.fixture.cache.Items()
			require.NotEmpty(t, items)
			for key, item := range items {
				testCase.fixture.cache.Set(key, item.Object, time.Nanosecond)
				require.Eventually(t, func() bool { _, ok := testCase.fixture.cache.Get(key); return !ok }, time.Second, time.Millisecond)
			}

			testCase.assertSearch(t, testCase.after)
			require.Greater(t, testCase.fixture.store.searches.Load(), calls, "expired results must be reloaded")
		})
	}
}

type searchPermissionMutationCase struct {
	fixture       *searchPermissionsFixture
	change        string
	targetID      int64
	roleID        int64
	caller        *user.SignedInUser
	query         string
	before, after map[string][]string
}

func newSearchPermissionMutationCase(t *testing.T, useGRPC bool, change string) *searchPermissionMutationCase {
	t.Helper()
	f := newSearchPermissionsFixture(t, useGRPC)
	usr := f.createUser(t, user.CreateUserCommand{UID: "target", OrgID: f.orgID, DefaultOrgRole: "None"})
	role := f.createRole(t, f.orgID, "managed:read", []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:one"}})
	before, after := map[string][]string{}, map[string][]string{"test:read": {"tests:id:one"}}
	switch change {
	case revokeChange:
		f.assignUser(t, f.orgID, usr.ID, role)
		before, after = after, before
	case removeTeamMembershipChange:
		f.assignTeam(t, f.orgID, role, usr.ID)
		before, after = after, before
	case basicRoleChange, downgradeBasicRoleChange:
		f.assignBuiltin(t, f.orgID, string(org.RoleViewer), role)
		if change == downgradeBasicRoleChange {
			require.NoError(t, f.sql.WithDbSession(context.Background(), func(sess *db.Session) error {
				_, err := sess.Exec("UPDATE org_user SET role = ? WHERE org_id = ? AND user_id = ?", string(org.RoleViewer), f.orgID, usr.ID)
				return err
			}))
			before, after = after, before
		}
	}
	return &searchPermissionMutationCase{
		fixture: f, change: change, targetID: usr.ID, roleID: role, caller: f.caller(f.orgID, "users:*"),
		query: fmt.Sprintf("namespacedId=user:%d&action=test:read", usr.ID), before: before, after: after,
	}
}

func (tc *searchPermissionMutationCase) assertSearch(t *testing.T, want map[string][]string) {
	t.Helper()
	tc.fixture.assertSearch(t, tc.caller, tc.query, searchPermissionsResponse{tc.targetID: want})
}

func (tc *searchPermissionMutationCase) mutate(t *testing.T) {
	t.Helper()
	f := tc.fixture
	switch tc.change {
	case grantChange:
		f.assignUser(t, f.orgID, tc.targetID, tc.roleID)
	case teamMembershipChange:
		f.assignTeam(t, f.orgID, tc.roleID, tc.targetID)
	case removeTeamMembershipChange:
		require.NoError(t, f.sql.WithDbSession(context.Background(), func(sess *db.Session) error {
			_, err := sess.Exec("DELETE FROM team_member WHERE org_id = ? AND user_id = ?", f.orgID, tc.targetID)
			return err
		}))
	case revokeChange:
		require.NoError(t, f.sql.WithDbSession(context.Background(), func(sess *db.Session) error {
			_, err := sess.Exec("DELETE FROM user_role WHERE user_id = ? AND role_id = ?", tc.targetID, tc.roleID)
			return err
		}))
	case basicRoleChange, downgradeBasicRoleChange:
		nextRole := org.RoleViewer
		if tc.change == downgradeBasicRoleChange {
			nextRole = org.RoleNone
		}
		require.NoError(t, f.sql.WithDbSession(context.Background(), func(sess *db.Session) error {
			_, err := sess.Exec("UPDATE org_user SET role = ? WHERE org_id = ? AND user_id = ?", string(nextRole), f.orgID, tc.targetID)
			return err
		}))
	default:
		t.Fatalf("unsupported change case: %s", tc.change)
	}
}

func TestIntegrationSearchUsersPermissions_LegacyCallerIdentities(t *testing.T) {
	for _, mode := range []struct {
		name string
		grpc bool
	}{{"legacy", false}, {"grpc", true}} {
		t.Run(mode.name, func(t *testing.T) {
			f := newSearchPermissionsFixture(t, mode.grpc)
			target := f.createUser(t, user.CreateUserCommand{UID: "target", OrgID: f.orgID, DefaultOrgRole: "None"})
			grant := f.createRole(t, f.orgID, "managed:target", []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:one"}})
			f.assignUser(t, f.orgID, target.ID, grant)
			visibility := f.createRole(t, f.orgID, "managed:caller", []accesscontrol.Permission{{Action: accesscontrol.ActionUsersPermissionsRead, Scope: "users:*"}})
			f.assignBuiltin(t, f.orgID, string(org.RoleAdmin), visibility)
			want := searchPermissionsResponse{target.ID: {"test:read": {"tests:id:one"}}}
			for _, tc := range []struct {
				name   string
				caller user.SignedInUser
			}{
				{"anonymous", user.SignedInUser{IsAnonymous: true}},
				{"renderer", user.SignedInUser{AuthenticatedBy: "render"}},
				{"API key", user.SignedInUser{ApiKeyID: target.ID}},
			} {
				t.Run(tc.name, func(t *testing.T) {
					caller := tc.caller
					caller.OrgID, caller.OrgRole = f.orgID, org.RoleAdmin
					caller.Permissions = map[int64]map[string][]string{f.orgID: {accesscontrol.ActionUsersPermissionsRead: {"users:*"}}}
					f.assertSearch(t, &caller, "action=test:read", want)
					f.assertSearch(t, &caller, fmt.Sprintf("namespacedId=user:%d&action=test:read", target.ID), want)
				})
			}
		})
	}
}

func TestIntegrationSearchUsersPermissions_GRPCAdminRolesStayInOrganization(t *testing.T) {
	f := newSearchPermissionsFixture(t, true)
	member := f.createUser(t, user.CreateUserCommand{UID: "admin-member", IsAdmin: true, SkipOrgSetup: true})
	outsider := f.createUser(t, user.CreateUserCommand{UID: "admin-outsider", IsAdmin: true, SkipOrgSetup: true})
	f.insert(t, "org_user", &org.OrgUser{OrgID: f.orgID, UserID: member.ID, Role: org.RoleViewer, Created: time.Now(), Updated: time.Now()})
	f.insert(t, "org_user", &org.OrgUser{OrgID: f.otherOrgID, UserID: member.ID, Role: org.RoleEditor, Created: time.Now(), Updated: time.Now()})
	f.insert(t, "org_user", &org.OrgUser{OrgID: f.otherOrgID, UserID: outsider.ID, Role: org.RoleEditor, Created: time.Now(), Updated: time.Now()})
	for _, grant := range []struct{ role, action string }{
		{string(org.RoleViewer), "test:read"},
		{string(org.RoleEditor), "test:write"},
		{accesscontrol.RoleGrafanaAdmin, "test:server"},
	} {
		require.NoError(t, f.service.DeclareFixedRoles(accesscontrol.RoleRegistration{
			Role:   accesscontrol.RoleDTO{Name: "fixed:" + grant.action, Permissions: []accesscontrol.Permission{{Action: grant.action, Scope: "tests:*"}}},
			Grants: []string{grant.role},
		}))
	}
	require.NoError(t, f.service.RegisterFixedRoles(t.Context()))
	caller := f.caller(f.orgID, "users:*")
	want := searchPermissionsResponse{
		member.ID:   {"test:read": {"tests:*"}, "test:server": {"tests:*"}},
		outsider.ID: {"test:server": {"tests:*"}},
	}
	f.assertSearch(t, caller, "actionPrefix=test:", want)
	for id, permissions := range want {
		f.assertSearch(t, caller, fmt.Sprintf("namespacedId=user:%d&actionPrefix=test:", id), searchPermissionsResponse{id: permissions})
	}
}
