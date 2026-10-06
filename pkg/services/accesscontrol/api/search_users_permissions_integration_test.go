package api_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/api"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

type searchPermissionsResponse map[int64]map[string][]string

func TestIntegrationSearchUsersPermissions_Assignments(t *testing.T) {
	f := newSearchPermissionsFixture(t)
	alice := f.createUser(t, user.CreateUserCommand{UID: "alice", OrgID: f.orgID, DefaultOrgRole: "Viewer"})
	bob := f.createUser(t, user.CreateUserCommand{UID: "bob", OrgID: f.orgID, DefaultOrgRole: "Editor"})
	noRole := f.createUser(t, user.CreateUserCommand{UID: "no-role", OrgID: f.orgID, DefaultOrgRole: "None"})
	f.createUser(t, user.CreateUserCommand{UID: "no-permissions", OrgID: f.orgID, DefaultOrgRole: "None"})
	outsider := f.createUser(t, user.CreateUserCommand{UID: "outsider", OrgID: f.otherOrgID, DefaultOrgRole: "Viewer"})

	direct := f.createRole(t, f.orgID, "managed:direct", []accesscontrol.Permission{
		{Action: "test:read", Scope: "tests:id:direct"},
		{Action: "test:write", Scope: "tests:id:direct"},
	})
	f.assignUser(t, f.orgID, alice.ID, direct)
	f.assignUser(t, f.orgID, noRole.ID, direct)
	shared := f.createRole(t, f.orgID, "managed:team", []accesscontrol.Permission{
		{Action: "test:read", Scope: "tests:id:team"},
		{Action: "test:read", Scope: "tests:id:direct"},
	})
	f.assignTeam(t, f.orgID, shared, alice.ID, bob.ID)
	builtin := f.createRole(t, f.orgID, "managed:builtin", []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:builtin"}})
	f.assignBuiltin(t, f.orgID, string(org.RoleViewer), builtin)
	global := f.createRole(t, accesscontrol.GlobalOrgID, "managed:global", []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:global"}})
	f.assignUser(t, accesscontrol.GlobalOrgID, alice.ID, global)
	f.assignUser(t, accesscontrol.GlobalOrgID, outsider.ID, global)
	otherOrg := f.createRole(t, f.otherOrgID, "managed:other", []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:other-org"}})
	f.assignUser(t, f.otherOrgID, outsider.ID, otherOrg)

	read := searchPermissionsResponse{
		alice.ID:  {"test:read": {"tests:id:direct", "tests:id:team", "tests:id:builtin", "tests:id:global"}},
		bob.ID:    {"test:read": {"tests:id:team", "tests:id:direct"}},
		noRole.ID: {"test:read": {"tests:id:direct"}},
	}
	tests := []struct {
		name  string
		query string
		want  searchPermissionsResponse
	}{
		{"direct team builtin and global grants", "action=test:read", read},
		{"exact action excludes other actions", "action=test:write", searchPermissionsResponse{
			alice.ID: {"test:write": {"tests:id:direct"}}, noRole.ID: {"test:write": {"tests:id:direct"}},
		}},
		{"prefix includes both actions", "actionPrefix=test:", searchPermissionsResponse{
			alice.ID:  {"test:read": {"tests:id:direct", "tests:id:team", "tests:id:builtin", "tests:id:global"}, "test:write": {"tests:id:direct"}},
			bob.ID:    {"test:read": {"tests:id:team", "tests:id:direct"}},
			noRole.ID: {"test:read": {"tests:id:direct"}, "test:write": {"tests:id:direct"}},
		}},
		{"partial action prefix", "actionPrefix=test:r", read},
		{"exact action is not a prefix", "action=test:r", searchPermissionsResponse{}},
		{"unknown action", "action=test:missing", searchPermissionsResponse{}},
		{"unknown prefix", "actionPrefix=unknown:", searchPermissionsResponse{}},
		{"single user merges and deduplicates assignments", fmt.Sprintf("namespacedId=user:%d&action=test:read", alice.ID), searchPermissionsResponse{alice.ID: read[alice.ID]}},
		{"single user with no matching action keeps empty entry", fmt.Sprintf("namespacedId=user:%d&action=test:missing", alice.ID), searchPermissionsResponse{alice.ID: {}}},
		{"scope narrows team grants", "action=test:read&scope=tests:id:team", searchPermissionsResponse{
			alice.ID: {"test:read": {"tests:id:team"}}, bob.ID: {"test:read": {"tests:id:team"}},
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f.assertSearch(t, f.caller(f.orgID, "users:*"), tt.query, tt.want)
		})
	}
	f.assertSearch(t, f.caller(f.otherOrgID, "users:*"), "action=test:read", searchPermissionsResponse{
		outsider.ID: {"test:read": {"tests:id:global", "tests:id:other-org"}},
	})
}

func TestIntegrationSearchUsersPermissions_BasicRoles(t *testing.T) {
	f := newSearchPermissionsFixture(t)
	viewer := f.createUser(t, user.CreateUserCommand{UID: "viewer", OrgID: f.orgID, DefaultOrgRole: "Viewer"})
	editor := f.createUser(t, user.CreateUserCommand{UID: "editor", OrgID: f.orgID, DefaultOrgRole: "Editor"})
	admin := f.createUser(t, user.CreateUserCommand{UID: "admin", OrgID: f.orgID, DefaultOrgRole: "Admin"})
	noRole := f.createUser(t, user.CreateUserCommand{UID: "none", OrgID: f.orgID, DefaultOrgRole: "None"})
	serverAdmin := f.createUser(t, user.CreateUserCommand{UID: "server-admin", IsAdmin: true, SkipOrgSetup: true})
	disabled := f.createUser(t, user.CreateUserCommand{UID: "disabled", OrgID: f.orgID, DefaultOrgRole: "Viewer", IsDisabled: true})
	serviceAccount := f.createUser(t, user.CreateUserCommand{UID: "service-account", OrgID: f.orgID, DefaultOrgRole: "Viewer", IsServiceAccount: true})
	for _, grant := range []struct{ role, action, scope string }{
		{string(org.RoleViewer), "test:read", "tests:id:basic"},
		{string(org.RoleEditor), "test:write", "tests:id:basic"},
		{string(org.RoleAdmin), "test:admin", "tests:id:basic"},
		{accesscontrol.RoleGrafanaAdmin, "test:server", "tests:id:server"},
		{string(org.RoleViewer), "test:unscoped", ""},
	} {
		require.NoError(t, f.service.DeclareFixedRoles(accesscontrol.RoleRegistration{
			Role:   accesscontrol.RoleDTO{Name: "fixed:" + grant.action, Permissions: []accesscontrol.Permission{{Action: grant.action, Scope: grant.scope}}},
			Grants: []string{grant.role},
		}))
	}
	require.NoError(t, f.service.RegisterFixedRoles(context.Background()))
	stored := f.createRole(t, f.orgID, "managed:read", []accesscontrol.Permission{
		{Action: "test:read", Scope: "tests:id:basic"},
		{Action: "test:read", Scope: "tests:id:stored"},
	})
	f.assignUser(t, f.orgID, viewer.ID, stored)
	serverRole := f.createRole(t, f.orgID, "managed:server", []accesscontrol.Permission{{Action: "test:stored-server", Scope: "tests:id:server"}})
	f.assignBuiltin(t, f.orgID, accesscontrol.RoleGrafanaAdmin, serverRole)

	tests := []struct {
		name, query string
		want        searchPermissionsResponse
	}{
		{"viewer grants inherited by editor and org admin", "action=test:read", searchPermissionsResponse{
			viewer.ID: {"test:read": {"tests:id:basic", "tests:id:stored"}}, editor.ID: {"test:read": {"tests:id:basic"}},
			admin.ID: {"test:read": {"tests:id:basic"}}, disabled.ID: {"test:read": {"tests:id:basic"}}, serviceAccount.ID: {"test:read": {"tests:id:basic"}},
		}},
		{"editor grants inherited by org admin", "action=test:write", searchPermissionsResponse{
			editor.ID: {"test:write": {"tests:id:basic"}}, admin.ID: {"test:write": {"tests:id:basic"}},
		}},
		{"org admin grants require membership", "action=test:admin", searchPermissionsResponse{
			admin.ID: {"test:admin": {"tests:id:basic"}},
		}},
		{"server admin without membership has static permissions", "action=test:server", searchPermissionsResponse{serverAdmin.ID: {"test:server": {"tests:id:server"}}}},
		{"server admin without membership has stored permissions", "action=test:stored-server", searchPermissionsResponse{serverAdmin.ID: {"test:stored-server": {"tests:id:server"}}}},
		{"unscoped action serializes scopes as null", "action=test:unscoped", searchPermissionsResponse{
			viewer.ID: {"test:unscoped": nil}, editor.ID: {"test:unscoped": nil}, admin.ID: {"test:unscoped": nil},
			disabled.ID: {"test:unscoped": nil}, serviceAccount.ID: {"test:unscoped": nil},
		}},
		{"scope excludes unscoped permission", "action=test:unscoped&scope=tests:id:basic", searchPermissionsResponse{}},
		{"None role receives no static grants", fmt.Sprintf("namespacedId=user:%d", noRole.ID), searchPermissionsResponse{noRole.ID: {}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f.assertSearch(t, f.caller(f.orgID, "users:*"), tt.query, tt.want)
		})
	}
}

func TestIntegrationSearchUsersPermissions_Scopes(t *testing.T) {
	f := newSearchPermissionsFixture(t)
	users := map[string]int64{}
	for i, scope := range []string{"*", "tests:*", "tests:id:*", "tests:id:one", "tests:id:two", "tests:uid:one", "other:id:one", ""} {
		usr := f.createUser(t, user.CreateUserCommand{UID: fmt.Sprintf("scope-%d", i), OrgID: f.orgID, DefaultOrgRole: "None"})
		users[scope] = usr.ID
		role := f.createRole(t, f.orgID, fmt.Sprintf("managed:scope-%d", i), []accesscontrol.Permission{{Action: "test:read", Scope: scope}})
		f.assignUser(t, f.orgID, usr.ID, role)
	}
	tests := []struct {
		name, scope string
		matches     []string
	}{
		{"no scope filter", "", []string{"*", "tests:*", "tests:id:*", "tests:id:one", "tests:id:two", "tests:uid:one", "other:id:one", ""}},
		{"exact scope and covering wildcards", "tests:id:one", []string{"*", "tests:*", "tests:id:*", "tests:id:one"}},
		{"different resource ID", "tests:id:two", []string{"*", "tests:*", "tests:id:*", "tests:id:two"}},
		{"missing resource still covered by wildcards", "tests:id:missing", []string{"*", "tests:*", "tests:id:*"}},
		{"UID attribute does not match ID attribute", "tests:uid:one", []string{"*", "tests:*", "tests:uid:one"}},
		{"different resource kind", "other:id:one", []string{"*", "other:id:one"}},
		{"attribute wildcard query does not expand concrete scopes", "tests:id:*", []string{"*", "tests:*", "tests:id:*"}},
		{"resource wildcard query", "tests:*", []string{"*", "tests:*"}},
		{"global wildcard query", "*", []string{"*"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			want := searchPermissionsResponse{}
			for _, scope := range tt.matches {
				want[users[scope]] = map[string][]string{"test:read": {scope}}
				if scope == "" {
					want[users[scope]]["test:read"] = nil
				}
			}
			f.assertSearch(t, f.caller(f.orgID, "users:*"), "action=test:read&scope="+tt.scope, want)
		})
	}

	t.Run("response reduces redundant scopes independently per action", func(t *testing.T) {
		usr := f.createUser(t, user.CreateUserCommand{UID: "reduction", OrgID: f.orgID, DefaultOrgRole: "None"})
		role := f.createRole(t, f.orgID, "managed:reduction", []accesscontrol.Permission{
			{Action: "test:read", Scope: "tests:id:one"}, {Action: "test:read", Scope: "tests:id:*"},
			{Action: "test:read", Scope: "tests:*"}, {Action: "test:read", Scope: "*"},
			{Action: "test:write", Scope: "tests:id:one"}, {Action: "test:write", Scope: "tests:id:*"},
			{Action: "test:write", Scope: "tests:uid:one"},
		})
		f.assignUser(t, f.orgID, usr.ID, role)
		f.assertSearch(t, f.caller(f.orgID, "users:*"), fmt.Sprintf("namespacedId=user:%d&actionPrefix=test:", usr.ID), searchPermissionsResponse{
			usr.ID: {"test:read": {"*"}, "test:write": {"tests:id:*", "tests:uid:one"}},
		})
	})
}

func TestIntegrationSearchUsersPermissions_StaticScopes(t *testing.T) {
	f := newSearchPermissionsFixture(t)
	viewer := f.createUser(t, user.CreateUserCommand{UID: "viewer", OrgID: f.orgID, DefaultOrgRole: "Viewer"})
	require.NoError(t, f.service.DeclareFixedRoles(accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{Name: "fixed:test:scopes", Permissions: []accesscontrol.Permission{
			{Action: "test:exact", Scope: "tests:id:one"},
			{Action: "test:attribute", Scope: "tests:id:*"},
			{Action: "test:resource", Scope: "tests:*"},
		}},
		Grants: []string{string(org.RoleViewer)},
	}))
	require.NoError(t, f.service.RegisterFixedRoles(context.Background()))
	tests := []struct {
		scope string
		want  map[string][]string
	}{
		{"tests:id:one", map[string][]string{"test:exact": {"tests:id:one"}, "test:attribute": {"tests:id:*"}, "test:resource": {"tests:*"}}},
		{"tests:id:two", map[string][]string{"test:attribute": {"tests:id:*"}, "test:resource": {"tests:*"}}},
		{"tests:uid:one", map[string][]string{"test:resource": {"tests:*"}}},
		{"other:id:one", map[string][]string{}},
		{"tests:*", map[string][]string{"test:resource": {"tests:*"}}},
		{"*", map[string][]string{}},
	}
	for _, tt := range tests {
		t.Run(tt.scope, func(t *testing.T) {
			for _, target := range []string{"", fmt.Sprintf("&namespacedId=user:%d", viewer.ID)} {
				want := searchPermissionsResponse{}
				if target != "" || len(tt.want) > 0 {
					want[viewer.ID] = tt.want
				}
				f.assertSearch(t, f.caller(f.orgID, "users:*"), "actionPrefix=test:&scope="+tt.scope+target, want)
			}
		})
	}
}

func TestIntegrationSearchUsersPermissions_RolePrefixes(t *testing.T) {
	f := newSearchPermissionsFixture(t)
	usr := f.createUser(t, user.CreateUserCommand{UID: "member", OrgID: f.orgID, DefaultOrgRole: "None"})
	for _, kind := range []string{"managed", "extsvc", "custom", "fixed", "basic"} {
		role := f.createRole(t, f.orgID, kind+":test", []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:" + kind}})
		f.assignUser(t, f.orgID, usr.ID, role)
	}
	for _, query := range []string{"action=test:read", "actionPrefix=test:", fmt.Sprintf("namespacedId=user:%d", usr.ID)} {
		t.Run(query, func(t *testing.T) {
			f.assertSearch(t, f.caller(f.orgID, "users:*"), query, searchPermissionsResponse{
				usr.ID: {"test:read": {"tests:id:managed", "tests:id:extsvc"}},
			})
		})
	}
}

func TestIntegrationSearchUsersPermissions_ActionSets(t *testing.T) {
	f := newSearchPermissionsFixture(t)
	alice := f.createUser(t, user.CreateUserCommand{UID: "alice", OrgID: f.orgID, DefaultOrgRole: "None"})
	require.NoError(t, f.orgs.AddOrgUser(context.Background(), &org.AddOrgUserCommand{OrgID: f.otherOrgID, UserID: alice.ID, Role: org.RoleNone}))
	f.actions.StoreActionSet("dashboards:edit", []string{"dashboards:read", "dashboards:write", "dashboards.permissions:read"})
	role := f.createRole(t, f.orgID, "managed:action-set", []accesscontrol.Permission{
		{Action: "dashboards:edit", Scope: "dashboards:uid:one"},
		{Action: "dashboards:read", Scope: "dashboards:uid:one"},
		{Action: "dashboards:read", Scope: "dashboards:uid:two"},
	})
	f.assignUser(t, f.orgID, alice.ID, role)
	other := f.createRole(t, f.otherOrgID, "managed:action-set", []accesscontrol.Permission{{Action: "dashboards:edit", Scope: "dashboards:uid:other-org"}})
	f.assignUser(t, f.otherOrgID, alice.ID, other)
	for _, prefix := range []string{"fixed:", "custom:"} {
		excluded := f.createRole(t, f.orgID, prefix+"excluded", []accesscontrol.Permission{{Action: "dashboards:edit", Scope: "dashboards:uid:excluded"}})
		f.assignUser(t, f.orgID, alice.ID, excluded)
	}

	tests := []struct {
		name, query string
		want        map[string][]string
	}{
		{"exact action expands sets and deduplicates direct permission", "action=dashboards:read", map[string][]string{"dashboards:read": {"dashboards:uid:one", "dashboards:uid:two"}}},
		{"exact action excludes other actions in set", "action=dashboards:write", map[string][]string{"dashboards:write": {"dashboards:uid:one"}}},
		{"action prefix filters expanded actions", "actionPrefix=dashboards:", map[string][]string{"dashboards:read": {"dashboards:uid:one", "dashboards:uid:two"}, "dashboards:write": {"dashboards:uid:one"}}},
		{"narrow prefix filters expanded actions", "actionPrefix=dashboards:w", map[string][]string{"dashboards:write": {"dashboards:uid:one"}}},
		{"prefix reaches action outside set name", "actionPrefix=dashboards.permissions:", map[string][]string{"dashboards.permissions:read": {"dashboards:uid:one"}}},
		{"scope filters action set grants", "action=dashboards:read&scope=dashboards:uid:one", map[string][]string{"dashboards:read": {"dashboards:uid:one"}}},
		{"scope filters direct grants", "action=dashboards:read&scope=dashboards:uid:two", map[string][]string{"dashboards:read": {"dashboards:uid:two"}}},
	}
	for _, tt := range tests {
		for _, target := range []string{"", fmt.Sprintf("&namespacedId=user:%d", alice.ID)} {
			t.Run(tt.name+target, func(t *testing.T) {
				f.assertSearch(t, f.caller(f.orgID, "users:*"), tt.query+target, searchPermissionsResponse{alice.ID: tt.want})
			})
		}
	}
	f.assertSearch(t, f.caller(f.otherOrgID, "users:*"), "actionPrefix=dashboards:", searchPermissionsResponse{
		alice.ID: {"dashboards:read": {"dashboards:uid:other-org"}, "dashboards:write": {"dashboards:uid:other-org"}},
	})
}

func TestIntegrationSearchUsersPermissions_Identities(t *testing.T) {
	f := newSearchPermissionsFixture(t)
	all := searchPermissionsResponse{}
	for _, typ := range []string{"user", "service-account"} {
		t.Run(typ, func(t *testing.T) {
			usr := f.createUser(t, user.CreateUserCommand{UID: typ + "-uid", OrgID: f.orgID, DefaultOrgRole: "None", IsServiceAccount: typ == "service-account"})
			role := f.createRole(t, f.orgID, "managed:"+typ, []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:" + typ}})
			f.assignUser(t, f.orgID, usr.ID, role)
			want := searchPermissionsResponse{usr.ID: {"test:read": {"tests:id:" + typ}}}
			all[usr.ID] = want[usr.ID]
			for _, id := range []string{fmt.Sprint(usr.ID), usr.UID} {
				for _, filter := range []string{"", "&action=test:read", "&actionPrefix=test:", "&scope=tests:id:" + typ} {
					t.Run(id+filter, func(t *testing.T) {
						query := "namespacedId=" + typ + ":" + id + filter
						f.assertSearch(t, f.caller(f.orgID, "users:*"), query, want)
						f.assertSearch(t, f.caller(f.orgID, "users:*"), query, want)
					})
				}
			}
		})
	}
	f.assertSearch(t, f.caller(f.orgID, "users:*"), "action=test:read", all)
}

func TestIntegrationSearchUsersPermissions_Visibility(t *testing.T) {
	f := newSearchPermissionsFixture(t)
	alice := f.createUser(t, user.CreateUserCommand{UID: "alice", OrgID: f.orgID, DefaultOrgRole: "None"})
	bob := f.createUser(t, user.CreateUserCommand{UID: "bob", OrgID: f.orgID, DefaultOrgRole: "None"})
	role := f.createRole(t, f.orgID, "managed:read", []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:one"}})
	f.assignUser(t, f.orgID, alice.ID, role)
	f.assignUser(t, f.orgID, bob.ID, role)
	all := searchPermissionsResponse{alice.ID: {"test:read": {"tests:id:one"}}, bob.ID: {"test:read": {"tests:id:one"}}}
	tests := []struct {
		name   string
		scopes []string
		want   searchPermissionsResponse
	}{
		{"resource wildcard", []string{"users:*"}, all},
		{"attribute wildcard", []string{"users:id:*"}, all},
		{"global wildcard", []string{"*"}, all},
		{"one visible user", []string{fmt.Sprintf("users:id:%d", alice.ID)}, searchPermissionsResponse{alice.ID: all[alice.ID]}},
		{"multiple visible users", []string{fmt.Sprintf("users:id:%d", alice.ID), fmt.Sprintf("users:id:%d", bob.ID)}, all},
		{"duplicate visibility scopes", []string{fmt.Sprintf("users:id:%d", alice.ID), fmt.Sprintf("users:id:%d", alice.ID)}, searchPermissionsResponse{alice.ID: all[alice.ID]}},
		{"unknown user", []string{"users:id:99999"}, searchPermissionsResponse{}},
		{"malformed scope ignored", []string{"users", "users:id:invalid"}, searchPermissionsResponse{}},
		{"empty visibility scopes", []string{}, searchPermissionsResponse{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f.assertSearch(t, f.caller(f.orgID, tt.scopes...), "action=test:read", tt.want)
		})
	}
	for _, permissions := range []map[int64]map[string][]string{
		{},
		{f.orgID: {"test:read": {"*"}}},
		{f.otherOrgID: {accesscontrol.ActionUsersPermissionsRead: {"users:*"}}},
	} {
		caller := &user.SignedInUser{UserID: 1000, OrgID: f.orgID, Permissions: permissions}
		status, body := f.request(t, caller, "action=test:read")
		require.Equal(t, http.StatusForbidden, status, string(body))
	}
}

func TestIntegrationSearchUsersPermissions_Validation(t *testing.T) {
	f := newSearchPermissionsFixture(t)
	usr := f.createUser(t, user.CreateUserCommand{UID: "member", OrgID: f.orgID, DefaultOrgRole: "None"})
	outsider := f.createUser(t, user.CreateUserCommand{UID: "outsider", OrgID: f.otherOrgID, DefaultOrgRole: "None"})
	tests := []struct {
		name, query string
		status      int
		message     string
	}{
		{"empty search", "", http.StatusBadRequest, "at least one search option must be provided"},
		{"empty values", "action=&actionPrefix=&namespacedId=", http.StatusBadRequest, "at least one search option must be provided"},
		{"scope only", "scope=tests:id:one", http.StatusBadRequest, "at least one search option must be provided"},
		{"conflicting filters", "action=test:read&actionPrefix=test:", http.StatusBadRequest, "mutually exclusive"},
		{"conflicting filters with target", fmt.Sprintf("namespacedId=user:%d&action=test:read&actionPrefix=test:", usr.ID), http.StatusBadRequest, "mutually exclusive"},
		{"missing user UID", "namespacedId=user:missing", http.StatusBadRequest, "not found"},
		{"missing service account UID", "namespacedId=service-account:missing", http.StatusBadRequest, "not found"},
		{"unsupported identity type", "namespacedId=team:1", http.StatusInternalServerError, "invalid type"},
		{"malformed typed ID", "namespacedId=invalid", http.StatusInternalServerError, "expected id to have 2 parts"},
		{"zero target without filter", "namespacedId=user:0", http.StatusBadRequest, "at least one search option must be provided"},
		{"negative target without filter", "namespacedId=user:-1", http.StatusBadRequest, "at least one search option must be provided"},
		{"unknown numeric ID", "namespacedId=user:99999", http.StatusInternalServerError, "could not get org user permissions"},
		{"target in another organization", fmt.Sprintf("namespacedId=user:%d", outsider.ID), http.StatusInternalServerError, "could not get org user permissions"},
		{"target UID in another organization", "namespacedId=user:outsider", http.StatusInternalServerError, "could not get org user permissions"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, body := f.request(t, f.caller(f.orgID, "users:*"), tt.query)
			require.Equal(t, tt.status, status, string(body))
			require.Contains(t, string(body), tt.message)
		})
	}
}

func TestIntegrationSearchUsersPermissions_CacheIsolation(t *testing.T) {
	f := newSearchPermissionsFixture(t)
	alice := f.createUser(t, user.CreateUserCommand{UID: "alice", OrgID: f.orgID, DefaultOrgRole: "None"})
	bob := f.createUser(t, user.CreateUserCommand{UID: "bob", OrgID: f.orgID, DefaultOrgRole: "None"})
	require.NoError(t, f.orgs.AddOrgUser(context.Background(), &org.AddOrgUserCommand{OrgID: f.otherOrgID, UserID: alice.ID, Role: org.RoleNone}))
	role := f.createRole(t, f.orgID, "managed:alice", []accesscontrol.Permission{
		{Action: "test:read", Scope: "tests:id:one"}, {Action: "test:read", Scope: "tests:id:two"}, {Action: "test:write", Scope: "tests:id:one"},
	})
	f.assignUser(t, f.orgID, alice.ID, role)
	bobRole := f.createRole(t, f.orgID, "managed:bob", []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:bob"}})
	f.assignUser(t, f.orgID, bob.ID, bobRole)
	otherRole := f.createRole(t, f.otherOrgID, "managed:alice", []accesscontrol.Permission{{Action: "test:read", Scope: "tests:id:other-org"}})
	f.assignUser(t, f.otherOrgID, alice.ID, otherRole)
	tests := []struct {
		name          string
		orgID, userID int64
		filter        string
		want          map[string][]string
	}{
		{"all permissions", f.orgID, alice.ID, "", map[string][]string{"test:read": {"tests:id:one", "tests:id:two"}, "test:write": {"tests:id:one"}}},
		{"exact read", f.orgID, alice.ID, "&action=test:read", map[string][]string{"test:read": {"tests:id:one", "tests:id:two"}}},
		{"different action", f.orgID, alice.ID, "&action=test:write", map[string][]string{"test:write": {"tests:id:one"}}},
		{"action prefix", f.orgID, alice.ID, "&actionPrefix=test:w", map[string][]string{"test:write": {"tests:id:one"}}},
		{"first scope", f.orgID, alice.ID, "&action=test:read&scope=tests:id:one", map[string][]string{"test:read": {"tests:id:one"}}},
		{"second scope", f.orgID, alice.ID, "&action=test:read&scope=tests:id:two", map[string][]string{"test:read": {"tests:id:two"}}},
		{"no matching scope", f.orgID, alice.ID, "&action=test:read&scope=tests:id:missing", map[string][]string{}},
		{"different user", f.orgID, bob.ID, "&action=test:read", map[string][]string{"test:read": {"tests:id:bob"}}},
		{"same user in different org", f.otherOrgID, alice.ID, "&action=test:read", map[string][]string{"test:read": {"tests:id:other-org"}}},
	}
	// Keep the same service alive across both passes to detect cache keys that omit a filter or organization.
	for _, pass := range []string{"first request", "repeat request"} {
		t.Run(pass, func(t *testing.T) {
			for _, tt := range tests {
				t.Run(tt.name, func(t *testing.T) {
					f.assertSearch(t, f.caller(tt.orgID, "users:*"), fmt.Sprintf("namespacedId=user:%d%s", tt.userID, tt.filter), searchPermissionsResponse{tt.userID: tt.want})
				})
			}
		})
	}
}

type searchPermissionsFixture struct {
	sql               *sqlstore.SQLStore
	service           *acimpl.Service
	users             user.Service
	orgs              org.Service
	server            *webtest.Server
	actions           resourcepermissions.ActionSetService
	cache             *localcache.CacheService
	store             *searchPermissionsStore
	orgID, otherOrgID int64
}

func newSearchPermissionsFixture(t *testing.T) *searchPermissionsFixture {
	t.Helper()
	testutil.SkipIntegrationTestInShortMode(t)
	cfg := setting.NewCfg()
	sql := db.NewTestStore(t, sqlstore.WithCfg(cfg))
	features := featuremgmt.WithFeatures()
	tracer := tracing.InitializeTracerForTest()
	provider := legacysql.NewDatabaseProvider(sql)
	orgs, err := orgimpl.ProvideService(provider, cfg, quotatest.New(false, nil))
	require.NoError(t, err)
	orgID, err := orgs.GetOrCreate(context.Background(), "permission-search")
	require.NoError(t, err)
	otherOrgID, err := orgs.GetOrCreate(context.Background(), "other-org")
	require.NoError(t, err)
	cfg.AutoAssignOrg = true
	cfg.AutoAssignOrgId = int(orgID)
	cfg.AutoAssignOrgRole = string(org.RoleViewer)
	teams, err := teamimpl.ProvideService(provider, cfg, tracer, nil, iam.Features{})
	require.NoError(t, err)
	users, err := userimpl.ProvideService(provider, orgs, cfg, teams, localcache.ProvideService(), tracer,
		quotatest.New(false, nil), supportbundlestest.NewFakeBundleService(), nil)
	require.NoError(t, err)
	actions := resourcepermissions.NewActionSetService()
	registry := permreg.ProvidePermissionRegistry()
	registry.RegisterPluginScope("tests:id:")
	cache := localcache.ProvideService()
	store := &searchPermissionsStore{Store: database.ProvideService(sql)}
	service := acimpl.ProvideOSSService(cfg, store, actions, cache,
		features, tracer, sql, registry, nil, iam.Features{})
	routes := routing.NewRouteRegister()
	api.NewAccessControlAPI(routes, acimpl.ProvideAccessControl(features), service, users).RegisterAPIEndpoints()
	return &searchPermissionsFixture{
		sql: sql, service: service, users: users, orgs: orgs, actions: actions, cache: cache, store: store,
		server: webtest.NewServer(t, routes), orgID: orgID, otherOrgID: otherOrgID,
	}
}

func (f *searchPermissionsFixture) createUser(t *testing.T, cmd user.CreateUserCommand) *user.User {
	t.Helper()
	cmd.Login = cmd.UID
	cmd.Email = cmd.UID + "@example.com"
	usr, err := f.users.Create(context.Background(), &cmd)
	require.NoError(t, err)
	return usr
}

func (f *searchPermissionsFixture) insert(t *testing.T, table string, value any) {
	t.Helper()
	require.NoError(t, f.sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Table(table).Insert(value)
		return err
	}))
}

func (f *searchPermissionsFixture) createRole(t *testing.T, orgID int64, name string, permissions []accesscontrol.Permission) int64 {
	t.Helper()
	now := time.Now()
	role := accesscontrol.Role{OrgID: orgID, UID: fmt.Sprintf("%d-%s", orgID, name), Name: name, Version: 1, Created: now, Updated: now}
	f.insert(t, "role", &role)
	for _, permission := range permissions {
		permission.RoleID = role.ID
		permission.Created, permission.Updated = now, now
		permission.Kind, permission.Attribute, permission.Identifier = permission.SplitScope()
		f.insert(t, "permission", &permission)
	}
	return role.ID
}

func (f *searchPermissionsFixture) assignUser(t *testing.T, orgID, userID, roleID int64) {
	t.Helper()
	f.insert(t, "user_role", &accesscontrol.UserRole{OrgID: orgID, UserID: userID, RoleID: roleID, Created: time.Now()})
}

func (f *searchPermissionsFixture) assignBuiltin(t *testing.T, orgID int64, builtin string, roleID int64) {
	t.Helper()
	f.insert(t, "builtin_role", &accesscontrol.BuiltinRole{OrgID: orgID, Role: builtin, RoleID: roleID, Created: time.Now(), Updated: time.Now()})
}

func (f *searchPermissionsFixture) assignTeam(t *testing.T, orgID, roleID int64, members ...int64) {
	t.Helper()
	group := team.Team{OrgID: orgID, Name: fmt.Sprintf("team-%d", roleID), UID: fmt.Sprintf("team-%d", roleID), Created: time.Now(), Updated: time.Now()}
	f.insert(t, "team", &group)
	f.insert(t, "team_role", &accesscontrol.TeamRole{OrgID: orgID, TeamID: group.ID, RoleID: roleID, Created: time.Now()})
	for _, member := range members {
		f.insert(t, "team_member", &team.TeamMember{UID: fmt.Sprintf("member-%d-%d", group.ID, member), OrgID: orgID, TeamID: group.ID, UserID: member, Permission: team.PermissionTypeMember, Created: time.Now(), Updated: time.Now()})
	}
}

func (f *searchPermissionsFixture) caller(orgID int64, scopes ...string) *user.SignedInUser {
	return &user.SignedInUser{UserID: 1000, OrgID: orgID, Permissions: map[int64]map[string][]string{
		orgID: {accesscontrol.ActionUsersPermissionsRead: scopes},
	}}
}

func (f *searchPermissionsFixture) request(t *testing.T, caller *user.SignedInUser, query string) (int, []byte) {
	t.Helper()
	req := f.server.NewGetRequest("/api/access-control/users/permissions/search?" + query)
	webtest.RequestWithSignedInUser(req, caller)
	res, err := f.server.Send(req)
	require.NoError(t, err)
	defer func() { require.NoError(t, res.Body.Close()) }()
	body, err := io.ReadAll(res.Body)
	require.NoError(t, err)
	return res.StatusCode, body
}

func (f *searchPermissionsFixture) assertSearch(t *testing.T, caller *user.SignedInUser, query string, want searchPermissionsResponse) {
	t.Helper()
	status, body := f.request(t, caller, query)
	require.Equal(t, http.StatusOK, status, string(body))
	var got searchPermissionsResponse
	require.NoError(t, json.Unmarshal(body, &got))
	require.NotNil(t, got, "empty searches must serialize as an object, not null")
	require.Len(t, got, len(want), string(body))
	for userID, actions := range want {
		require.Contains(t, got, userID)
		require.NotNil(t, got[userID], "users without matching permissions must have an empty object")
		require.Len(t, got[userID], len(actions), "user %d: %s", userID, body)
		for action, scopes := range actions {
			require.Contains(t, got[userID], action)
			if scopes == nil {
				require.Nil(t, got[userID][action], "unscoped actions must serialize scopes as null")
				continue
			}
			require.ElementsMatch(t, scopes, got[userID][action], "user %d, action %s", userID, action)
		}
	}
}

// Count search queries to distinguish a cache hit from an identical database result.
type searchPermissionsStore struct {
	accesscontrol.Store
	searches atomic.Int64
}

func (s *searchPermissionsStore) SearchUsersPermissions(ctx context.Context, orgID int64, options accesscontrol.SearchOptions) (map[int64][]accesscontrol.Permission, error) {
	s.searches.Add(1)
	return s.Store.SearchUsersPermissions(ctx, orgID, options)
}
