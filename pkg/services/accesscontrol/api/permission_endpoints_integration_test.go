package api_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
	"github.com/grafana/grafana/pkg/web/webtest"
)

const permissionActionsPath = "/api/access-control/user/actions"
const permissionScopesPath = "/api/access-control/user/permissions"
const permissionSearchPath = "/api/access-control/users/permissions/search"

type permissionEndpointFlags struct {
	search bool
	legacy bool
}

type permissionEndpointProvider struct{ openfeature.NoopProvider }

func (permissionEndpointProvider) BooleanEvaluation(_ context.Context, flag string, fallback bool, ctx openfeature.FlattenedContext) openfeature.BoolResolutionDetail {
	if value, ok := ctx[flag].(bool); ok {
		return openfeature.BoolResolutionDetail{Value: value}
	}
	return openfeature.BoolResolutionDetail{Value: fallback}
}

func newPermissionEndpointFixture(t *testing.T, flags permissionEndpointFlags) *searchPermissionsFixture {
	t.Helper()
	f := newSearchPermissionsFixture(t, flags.search)
	f.cfg.RBAC.PermissionCache = true
	require.NoError(t, openfeature.SetProviderAndWait(permissionEndpointProvider{}))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
	f.server.Mux.UseMiddleware(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ctx := openfeature.WithTransactionContext(req.Context(), openfeature.NewEvaluationContext("permission-endpoints", map[string]any{
				featuremgmt.FlagAuthzUserPermissionsSearch: flags.search,
				featuremgmt.FlagAuthzLegacyUserPermissions: flags.legacy,
			}))
			req = req.WithContext(ctx)
			web.FromContext(ctx).Req = req
			next.ServeHTTP(w, req)
		})
	})
	return f
}

func forPermissionEndpointModes(t *testing.T, run func(*testing.T, permissionEndpointFlags)) {
	t.Helper()
	for _, search := range []bool{false, true} {
		for _, legacy := range []bool{false, true} {
			t.Run(fmt.Sprintf("search=%t/enumeration=%t", search, legacy), func(t *testing.T) {
				run(t, permissionEndpointFlags{search: search, legacy: legacy})
			})
		}
	}
}

func permissionEndpointRequest(t *testing.T, f *searchPermissionsFixture, caller *user.SignedInUser, path string, signedIn bool) (int, []byte) {
	t.Helper()
	req := f.server.NewGetRequest(path)
	webtest.RequestWithWebContext(req, &contextmodel.ReqContext{SignedInUser: caller, IsSignedIn: signedIn})
	res, err := f.server.Send(req)
	require.NoError(t, err)
	defer func() { require.NoError(t, res.Body.Close()) }()
	body, err := io.ReadAll(res.Body)
	require.NoError(t, err)
	return res.StatusCode, body
}

func assertPermissionEndpoint(t *testing.T, f *searchPermissionsFixture, flags permissionEndpointFlags, caller *user.SignedInUser, path string, want map[string][]string) {
	t.Helper()
	beforeSearch, beforeEnumeration := f.rpcCalls.Load(), f.legacyCalls.Load()
	status, body := permissionEndpointRequest(t, f, caller, path, true)
	require.Equal(t, http.StatusOK, status, string(body))
	require.Equal(t, beforeSearch, f.rpcCalls.Load(), "current-user endpoints must not call search")
	if flags.legacy {
		require.Equal(t, beforeEnumeration+1, f.legacyCalls.Load(), "enumeration flag must select the embedded client")
	} else {
		require.Equal(t, beforeEnumeration, f.legacyCalls.Load(), "local enumeration must not call the embedded client")
	}
	if strings.HasPrefix(path, permissionActionsPath) {
		var got map[string]bool
		require.NoError(t, json.Unmarshal(body, &got))
		require.Len(t, got, len(want), string(body))
		for action := range want {
			require.True(t, got[action], action)
		}
		return
	}
	var got map[string][]string
	require.NoError(t, json.Unmarshal(body, &got))
	require.Len(t, got, len(want), string(body))
	for action, scopes := range want {
		require.Contains(t, got, action)
		require.ElementsMatch(t, scopes, got[action], action)
	}
}

func TestIntegrationPermissionEndpoints_IndependentCapabilities(t *testing.T) {
	forPermissionEndpointModes(t, func(t *testing.T, flags permissionEndpointFlags) {
		f := newPermissionEndpointFixture(t, flags)
		require.NoError(t, f.service.DeclareFixedRoles(accesscontrol.RoleRegistration{
			Role: accesscontrol.RoleDTO{Name: "fixed:endpoint:viewer", Permissions: []accesscontrol.Permission{
				{Action: "endpoint:basic", Scope: "tests:id:basic"},
				{Action: "endpoint:unscoped"},
			}},
			Grants: []string{string(org.RoleViewer)},
		}))
		require.NoError(t, f.service.RegisterFixedRoles(t.Context()))
		alice := f.createUser(t, user.CreateUserCommand{UID: "endpoint-alice", OrgID: f.orgID, DefaultOrgRole: "Viewer"})
		bob := f.createUser(t, user.CreateUserCommand{UID: "endpoint-bob", OrgID: f.orgID, DefaultOrgRole: "Editor"})
		serviceAccount := f.createUser(t, user.CreateUserCommand{UID: "endpoint-service", OrgID: f.orgID, DefaultOrgRole: "Viewer", IsServiceAccount: true})
		noRole := f.createUser(t, user.CreateUserCommand{UID: "endpoint-none", OrgID: f.orgID, DefaultOrgRole: "None"})
		outsider := f.createUser(t, user.CreateUserCommand{UID: "endpoint-outsider", OrgID: f.otherOrgID, DefaultOrgRole: "None"})
		direct := f.createRole(t, f.orgID, "managed:endpoint-direct", []accesscontrol.Permission{
			{Action: "endpoint:read", Scope: "tests:id:direct"},
			{Action: "endpoint:wildcard", Scope: "tests:*"},
			{Action: "endpoint:wildcard", Scope: "tests:id:one"},
		})
		f.assignUser(t, f.orgID, alice.ID, direct)
		f.assignUser(t, f.orgID, serviceAccount.ID, direct)
		teamRole := f.createRole(t, f.orgID, "managed:endpoint-team", []accesscontrol.Permission{
			{Action: "endpoint:read", Scope: "tests:id:team"},
			{Action: "endpoint:read", Scope: "tests:id:direct"},
		})
		f.assignTeam(t, f.orgID, teamRole, alice.ID, bob.ID)
		var group team.Team
		require.NoError(t, f.sql.WithDbSession(t.Context(), func(sess *db.Session) error {
			found, err := sess.Table("team").Where("org_id = ? AND name = ?", f.orgID, fmt.Sprintf("team-%d", teamRole)).Get(&group)
			if err != nil {
				return err
			}
			require.True(t, found)
			return nil
		}))
		aliceRequester := &user.SignedInUser{UserID: alice.ID, UserUID: alice.UID, OrgID: f.orgID, OrgRole: org.RoleViewer}
		aliceRequester.TeamIDs = []int64{group.ID} //nolint:staticcheck // Preserve authenticated numeric RBAC memberships across legacy transport.
		bobRequester := &user.SignedInUser{UserID: bob.ID, UserUID: bob.UID, OrgID: f.orgID, OrgRole: org.RoleEditor}
		bobRequester.TeamIDs = []int64{group.ID} //nolint:staticcheck // Preserve authenticated numeric RBAC memberships across legacy transport.
		foreign := f.createRole(t, f.otherOrgID, "managed:endpoint-foreign", []accesscontrol.Permission{{Action: "endpoint:foreign", Scope: "tests:id:foreign"}})
		f.assignUser(t, f.otherOrgID, outsider.ID, foreign)
		f.assignUser(t, f.otherOrgID, alice.ID, foreign)
		shared := map[string][]string{"folders:read": {"folders:uid:sharedwithme"}}
		identities := []struct {
			name   string
			caller *user.SignedInUser
			want   map[string][]string
		}{
			{"user direct team and inherited basic grants", aliceRequester, map[string][]string{
				"folders:read": {"folders:uid:sharedwithme"}, "endpoint:basic": {"tests:id:basic"}, "endpoint:unscoped": {""},
				"endpoint:read": {"tests:id:direct", "tests:id:direct", "tests:id:team"}, "endpoint:wildcard": {"tests:*", "tests:id:one"},
			}},
			{"editor inherits viewer and team grants", bobRequester, map[string][]string{
				"folders:read": {"folders:uid:sharedwithme"}, "endpoint:basic": {"tests:id:basic"}, "endpoint:unscoped": {""}, "endpoint:read": {"tests:id:team", "tests:id:direct"},
			}},
			{"service account direct and basic grants", &user.SignedInUser{UserID: serviceAccount.ID, UserUID: serviceAccount.UID, OrgID: f.orgID, OrgRole: org.RoleViewer, IsServiceAccount: true}, map[string][]string{
				"folders:read": {"folders:uid:sharedwithme"}, "endpoint:basic": {"tests:id:basic"}, "endpoint:unscoped": {""}, "endpoint:read": {"tests:id:direct"}, "endpoint:wildcard": {"tests:*", "tests:id:one"},
			}},
			{"no role retains only shared folder grant", &user.SignedInUser{UserID: noRole.ID, UserUID: noRole.UID, OrgID: f.orgID, OrgRole: org.RoleNone}, shared},
			{"other organization direct grant", &user.SignedInUser{UserID: outsider.ID, UserUID: outsider.UID, OrgID: f.otherOrgID, OrgRole: org.RoleNone}, map[string][]string{
				"folders:read": {"folders:uid:sharedwithme"}, "endpoint:foreign": {"tests:id:foreign"},
			}},
			{"same user cache is isolated by organization", &user.SignedInUser{UserID: alice.ID, UserUID: alice.UID, OrgID: f.otherOrgID, OrgRole: org.RoleNone}, map[string][]string{
				"folders:read": {"folders:uid:sharedwithme"}, "endpoint:foreign": {"tests:id:foreign"},
			}},
		}
		for _, identity := range identities {
			for _, path := range []string{permissionActionsPath, permissionScopesPath} {
				t.Run(identity.name+path, func(t *testing.T) { assertPermissionEndpoint(t, f, flags, identity.caller, path, identity.want) })
			}
		}
		for _, path := range []string{permissionActionsPath, permissionScopesPath, permissionSearchPath + "?action=endpoint:read"} {
			t.Run("anonymous denied"+path, func(t *testing.T) {
				beforeSearch, beforeEnumeration := f.rpcCalls.Load(), f.legacyCalls.Load()
				status, _ := permissionEndpointRequest(t, f, &user.SignedInUser{IsAnonymous: true, OrgID: f.orgID}, path, false)
				if strings.HasPrefix(path, permissionSearchPath) {
					require.Equal(t, http.StatusForbidden, status)
				} else {
					require.Equal(t, http.StatusUnauthorized, status)
				}
				require.Equal(t, beforeSearch, f.rpcCalls.Load())
				require.Equal(t, beforeEnumeration, f.legacyCalls.Load())
			})
		}
		caller := f.caller(f.orgID, "users:*")
		beforeEnumeration := f.legacyCalls.Load()
		t.Run("search retains reduction and unscoped contract", func(t *testing.T) {
			f.assertSearch(t, caller, fmt.Sprintf("namespacedId=user:%d&actionPrefix=endpoint:", alice.ID), searchPermissionsResponse{alice.ID: {
				"endpoint:basic": {"tests:id:basic"}, "endpoint:unscoped": nil, "endpoint:read": {"tests:id:direct", "tests:id:team"}, "endpoint:wildcard": {"tests:*"},
			}})
			require.Equal(t, beforeEnumeration, f.legacyCalls.Load(), "search must not call the current-user enumeration capability")
		})
		t.Run("search service account target", func(t *testing.T) {
			f.assertSearch(t, caller, fmt.Sprintf("namespacedId=service-account:%s&action=endpoint:read", serviceAccount.UID), searchPermissionsResponse{serviceAccount.ID: {"endpoint:read": {"tests:id:direct"}}})
		})
		t.Run("search empty target keeps an object", func(t *testing.T) {
			f.assertSearch(t, caller, fmt.Sprintf("namespacedId=user:%d&action=endpoint:missing", noRole.ID), searchPermissionsResponse{noRole.ID: {}})
		})
		for _, path := range []string{permissionActionsPath, permissionScopesPath} {
			t.Run("reloadcache refreshes direct grants"+path, func(t *testing.T) {
				fresh := f.createUser(t, user.CreateUserCommand{UID: fmt.Sprintf("reload-%d", len(path)), OrgID: f.orgID, DefaultOrgRole: "None"})
				requester := &user.SignedInUser{UserID: fresh.ID, UserUID: fresh.UID, OrgID: f.orgID, OrgRole: org.RoleNone}
				assertPermissionEndpoint(t, f, flags, requester, path, shared)
				granted := f.createRole(t, f.orgID, fmt.Sprintf("managed:reload-%d", fresh.ID), []accesscontrol.Permission{{Action: "endpoint:added", Scope: "tests:id:added"}})
				f.assignUser(t, f.orgID, fresh.ID, granted)
				assertPermissionEndpoint(t, f, flags, requester, path, shared)
				want := map[string][]string{"folders:read": {"folders:uid:sharedwithme"}, "endpoint:added": {"tests:id:added"}}
				assertPermissionEndpoint(t, f, flags, requester, path+"?reloadcache=true", want)
				assertPermissionEndpoint(t, f, flags, requester, path, want)
			})
		}
	})
}

func TestIntegrationPermissionEndpoints_DatabaseFailure(t *testing.T) {
	forPermissionEndpointModes(t, func(t *testing.T, flags permissionEndpointFlags) {
		f := newPermissionEndpointFixture(t, flags)
		caller := f.caller(f.orgID, "users:*")
		for _, path := range []string{permissionActionsPath, permissionScopesPath, permissionSearchPath + "?action=endpoint:missing"} {
			status, body := permissionEndpointRequest(t, f, caller, path, true)
			require.Equal(t, http.StatusOK, status, string(body))
		}
		// Each fixture owns its isolated test database; removing this table forces real SQL reads to fail.
		require.NoError(t, f.sql.WithDbSession(t.Context(), func(sess *db.Session) error {
			_, err := sess.Exec("DROP TABLE " + f.sql.Quote("permission"))
			return err
		}))
		for _, path := range []string{permissionActionsPath + "?reloadcache=true", permissionScopesPath + "?reloadcache=true", permissionSearchPath + "?action=endpoint:missing"} {
			t.Run(path, func(t *testing.T) {
				status, body := permissionEndpointRequest(t, f, caller, path, true)
				require.Equal(t, http.StatusInternalServerError, status, string(body))
			})
		}
	})
}

func TestIntegrationPermissionEndpoints_ActionSets(t *testing.T) {
	forPermissionEndpointModes(t, func(t *testing.T, flags permissionEndpointFlags) {
		f := newPermissionEndpointFixture(t, flags)
		f.actions.StoreActionSet("dashboards:edit", []string{"dashboards:read", "dashboards:write"})
		alice := f.createUser(t, user.CreateUserCommand{UID: "endpoint-action-sets", OrgID: f.orgID, DefaultOrgRole: "None"})
		role := f.createRole(t, f.orgID, "managed:endpoint-action-sets", []accesscontrol.Permission{
			{Action: "dashboards:edit", Scope: "dashboards:uid:one"},
			{Action: "dashboards:read", Scope: "dashboards:uid:one"},
		})
		f.assignUser(t, f.orgID, alice.ID, role)
		requester := &user.SignedInUser{UserID: alice.ID, UserUID: alice.UID, OrgID: f.orgID, OrgRole: org.RoleNone}
		want := map[string][]string{
			"folders:read":     {"folders:uid:sharedwithme"},
			"dashboards:read":  {"dashboards:uid:one", "dashboards:uid:one"},
			"dashboards:write": {"dashboards:uid:one"},
		}
		for _, path := range []string{permissionActionsPath, permissionScopesPath} {
			t.Run(path, func(t *testing.T) { assertPermissionEndpoint(t, f, flags, requester, path, want) })
		}
		t.Run(permissionSearchPath, func(t *testing.T) {
			f.assertSearch(t, f.caller(f.orgID, "users:*"), fmt.Sprintf("namespacedId=user:%d&action=dashboards:read", alice.ID), searchPermissionsResponse{alice.ID: {"dashboards:read": {"dashboards:uid:one"}}})
		})
	})
}
