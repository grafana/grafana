package ossaccesscontrol

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	iamapi "github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	serviceaccountsretriever "github.com/grafana/grafana/pkg/services/serviceaccounts/retriever"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/legacysql/legacywatch"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/web"
)

// TestIntegrationProvisionedTeamBulkPermissions is the spec for the provisioned-team
// lock on POST /api/access-control/teams/{teamID}. The single-user route rejects
// every membership change for a team with is_provisioned set. The bulk route must
// do the same, and it must do it before any team_member row is inserted, updated,
// or deleted. These cases fail while that lock is missing.
func TestIntegrationProvisionedTeamBulkPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("adding an org user as team admin is rejected", func(t *testing.T) {
		env := newProvisionedTeamEnv(t, false)
		before := env.membership(t, env.provisioned.ID)
		rec := env.postBulk(t, env.provisionedScope(), strconv.FormatInt(env.provisioned.ID, 10), []accesscontrol.SetResourcePermissionCommand{
			{UserID: env.outsider.ID, Permission: "Admin"},
		})
		env.requireUnchanged(t, env.provisioned.ID, before, rec)
	})

	t.Run("adding an org user as a member is rejected", func(t *testing.T) {
		env := newProvisionedTeamEnv(t, false)
		before := env.membership(t, env.provisioned.ID)
		rec := env.postBulk(t, env.provisionedScope(), strconv.FormatInt(env.provisioned.ID, 10), []accesscontrol.SetResourcePermissionCommand{
			{UserID: env.outsider.ID, Permission: "Member"},
		})
		env.requireUnchanged(t, env.provisioned.ID, before, rec)
	})

	t.Run("promoting a member to team admin is rejected", func(t *testing.T) {
		env := newProvisionedTeamEnv(t, false)
		before := env.membership(t, env.provisioned.ID)
		rec := env.postBulk(t, env.provisionedScope(), strconv.FormatInt(env.provisioned.ID, 10), []accesscontrol.SetResourcePermissionCommand{
			{UserID: env.member.ID, Permission: "Admin"},
		})
		env.requireUnchanged(t, env.provisioned.ID, before, rec)
	})

	t.Run("removing a member is rejected", func(t *testing.T) {
		env := newProvisionedTeamEnv(t, false)
		before := env.membership(t, env.provisioned.ID)
		rec := env.postBulk(t, env.provisionedScope(), strconv.FormatInt(env.provisioned.ID, 10), []accesscontrol.SetResourcePermissionCommand{
			{UserID: env.member.ID, Permission: ""},
		})
		env.requireUnchanged(t, env.provisioned.ID, before, rec)
	})

	t.Run("one request that adds an admin and removes a member is rejected", func(t *testing.T) {
		env := newProvisionedTeamEnv(t, false)
		before := env.membership(t, env.provisioned.ID)
		bystanderBefore := env.membership(t, env.bystander.ID)
		rec := env.postBulk(t, env.provisionedScope(), strconv.FormatInt(env.provisioned.ID, 10), []accesscontrol.SetResourcePermissionCommand{
			{UserID: env.outsider.ID, Permission: "Admin"},
			{UserID: env.member.ID, Permission: ""},
		})
		require.Equal(t, bystanderBefore, env.membership(t, env.bystander.ID), "bulk write changed a team that was not in the authorized URL")
		env.requireUnchanged(t, env.provisioned.ID, before, rec)
	})

	t.Run("team uid in the url still authorizes and must lock the translated team", func(t *testing.T) {
		env := newProvisionedTeamEnv(t, false)
		before := env.membership(t, env.provisioned.ID)
		// The route translates the UID to the numeric id before evaluating
		// teams.permissions:write on teams:id:<id>. The write has to be that team.
		rec := env.postBulk(t, env.provisionedScope(), env.provisioned.UID, []accesscontrol.SetResourcePermissionCommand{
			{UserID: env.outsider.ID, Permission: "Admin"},
		})
		env.requireUnchanged(t, env.provisioned.ID, before, rec)
	})

	t.Run("org-wide teams.permissions:write is still rejected", func(t *testing.T) {
		env := newProvisionedTeamEnv(t, false)
		before := env.membership(t, env.provisioned.ID)
		rec := env.postBulk(t, accesscontrol.ScopeTeamsAll, strconv.FormatInt(env.provisioned.ID, 10), []accesscontrol.SetResourcePermissionCommand{
			{UserID: env.outsider.ID, Permission: "Admin"},
		})
		env.requireUnchanged(t, env.provisioned.ID, before, rec)
	})

	t.Run("group sync enabled does not change the lock", func(t *testing.T) {
		env := newProvisionedTeamEnv(t, true)
		before := env.membership(t, env.provisioned.ID)
		rec := env.postBulk(t, env.provisionedScope(), strconv.FormatInt(env.provisioned.ID, 10), []accesscontrol.SetResourcePermissionCommand{
			{UserID: env.outsider.ID, Permission: "Admin"},
			{UserID: env.member.ID, Permission: ""},
		})
		env.requireUnchanged(t, env.provisioned.ID, before, rec)
	})

	t.Run("kubernetes teams redirect fallback still rejects before the legacy write", func(t *testing.T) {
		setTeamRedirectFlag(t, true)
		enabled, err := openfeature.NewDefaultClient().BooleanValue(context.Background(), featuremgmt.FlagKubernetesTeamsRedirect, false, openfeature.EvaluationContext{})
		require.NoError(t, err)
		require.True(t, enabled, "kubernetesTeamsRedirect must be on so this request takes the redirect fallback")
		env := newProvisionedTeamEnv(t, false)
		before := env.membership(t, env.provisioned.ID)
		// No loopback rest config is registered, so the redirect cannot reach
		// the team apiserver and SetPermissions falls back to the legacy hook.
		rec := env.postBulk(t, env.provisionedScope(), strconv.FormatInt(env.provisioned.ID, 10), []accesscontrol.SetResourcePermissionCommand{
			{UserID: env.outsider.ID, Permission: "Admin"},
		})
		env.requireUnchanged(t, env.provisioned.ID, before, rec)
	})

	t.Run("write permission on a different team does not authorize this team", func(t *testing.T) {
		env := newProvisionedTeamEnv(t, false)
		before := env.membership(t, env.provisioned.ID)
		rec := env.postBulk(t, accesscontrol.Scope("teams", "id", strconv.FormatInt(env.bystander.ID, 10)), strconv.FormatInt(env.provisioned.ID, 10), []accesscontrol.SetResourcePermissionCommand{
			{UserID: env.outsider.ID, Permission: "Admin"},
		})
		require.Equal(t, before, env.membership(t, env.provisioned.ID))
		require.Equal(t, http.StatusForbidden, rec.Code, rec.Body.String())
	})

	t.Run("non-provisioned team still accepts a bulk admin assignment", func(t *testing.T) {
		env := newProvisionedTeamEnv(t, false)
		rec := env.postBulk(t, accesscontrol.Scope("teams", "id", strconv.FormatInt(env.bystander.ID, 10)), strconv.FormatInt(env.bystander.ID, 10), []accesscontrol.SetResourcePermissionCommand{
			{UserID: env.outsider.ID, Permission: "Admin"},
		})
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		require.Equal(t, team.PermissionTypeAdmin, env.membership(t, env.bystander.ID)[env.outsider.ID])
	})

	t.Run("single-user route keeps rejecting a provisioned team", func(t *testing.T) {
		env := newProvisionedTeamEnv(t, false)
		before := env.membership(t, env.provisioned.ID)
		body := strings.NewReader(`{"permission":"Admin"}`)
		req, err := http.NewRequest(http.MethodPost, fmt.Sprintf("/api/access-control/teams/%d/users/%d", env.provisioned.ID, env.outsider.ID), body)
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		env.serverFor(t, env.provisionedScope()).ServeHTTP(rec, req)
		require.Equal(t, before, env.membership(t, env.provisioned.ID))
		require.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())
		require.Contains(t, rec.Body.String(), "provisioned")
	})
}

type provisionedTeamEnv struct {
	teamSvc     team.Service
	routes      routing.RouteRegister
	provisioned team.Team
	bystander   team.Team
	member      *user.User
	outsider    *user.User
	caller      *user.User
}

func newProvisionedTeamEnv(t *testing.T, groupSync bool) *provisionedTeamEnv {
	t.Helper()

	cfg := setting.NewCfg()
	cfg.AutoAssignOrg = true
	cfg.AutoAssignOrgId = 1
	if groupSync {
		cfg.Raw.Section("auth.scim").Key("group_sync_enabled").SetValue("true")
	}

	sql := sqlstore.NewTestStore(t, sqlstore.WithCfg(cfg))
	tracer := tracing.InitializeTracerForTest()
	dbProvider := legacysql.NewDatabaseProvider(sql)

	orgSvc, err := orgimpl.ProvideService(dbProvider, cfg, quotatest.New(false, nil))
	require.NoError(t, err)
	_, err = orgSvc.GetOrCreate(context.Background(), "Main Org.")
	require.NoError(t, err)

	teamSvc, err := teamimpl.ProvideService(dbProvider, cfg, tracer, nil, iamapi.Features{})
	require.NoError(t, err)
	userSvc, err := userimpl.ProvideService(
		dbProvider, orgSvc, cfg, teamSvc, nil, tracer,
		quotatest.New(false, nil), supportbundlestest.NewFakeBundleService(), nil,
	)
	require.NoError(t, err)

	watch := legacywatch.NewPublisher(nil, func(int64) string { return "org-1" })
	router := routing.NewRouteRegister()
	_, err = ProvideTeamPermissions(
		cfg, featuremgmt.WithFeatures(), router, sql, iamapi.Features{},
		acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
		&licensing.OSSLicensingService{},
		&actest.FakeService{},
		teamSvc, userSvc,
		serviceaccountsretriever.ProvideService(sql, nil, nil, userSvc, orgSvc),
		resourcepermissions.NewActionSetService(),
		nil,
		watch,
	)
	require.NoError(t, err)

	env := &provisionedTeamEnv{teamSvc: teamSvc}
	env.caller = createOrgUser(t, userSvc, "caller")
	env.member = createOrgUser(t, userSvc, "member")
	env.outsider = createOrgUser(t, userSvc, "outsider")

	env.provisioned = createTeam(t, teamSvc, "provisioned-team", true)
	env.bystander = createTeam(t, teamSvc, "plain-team", false)
	require.True(t, env.provisioned.IsProvisioned)
	require.False(t, env.bystander.IsProvisioned)

	seedTeamMember(t, sql, env.provisioned.OrgID, env.provisioned.ID, env.member.ID, team.PermissionTypeMember)
	require.Equal(t, map[int64]team.PermissionType{env.member.ID: team.PermissionTypeMember}, env.membership(t, env.provisioned.ID))

	env.routes = router
	return env
}

func (e *provisionedTeamEnv) provisionedScope() string {
	return accesscontrol.Scope("teams", "id", strconv.FormatInt(e.provisioned.ID, 10))
}

func (e *provisionedTeamEnv) postBulk(t *testing.T, scope, resourceID string, permissions []accesscontrol.SetResourcePermissionCommand) *httptest.ResponseRecorder {
	t.Helper()
	payload, err := json.Marshal(struct {
		Permissions []accesscontrol.SetResourcePermissionCommand `json:"permissions"`
	}{Permissions: permissions})
	require.NoError(t, err)

	req, err := http.NewRequest(http.MethodPost, "/api/access-control/teams/"+resourceID, strings.NewReader(string(payload)))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.serverFor(t, scope).ServeHTTP(rec, req)
	return rec
}

func (e *provisionedTeamEnv) requireUnchanged(t *testing.T, teamID int64, before map[int64]team.PermissionType, rec *httptest.ResponseRecorder) {
	t.Helper()
	after := e.membership(t, teamID)
	require.Equal(t, before, after, "membership changed before the request was refused; status=%d body=%s", rec.Code, rec.Body.String())
	require.Equal(t, http.StatusBadRequest, rec.Code, rec.Body.String())
	require.Contains(t, rec.Body.String(), "provisioned")
}

func (e *provisionedTeamEnv) membership(t *testing.T, teamID int64) map[int64]team.PermissionType {
	t.Helper()
	members, err := e.teamSvc.GetTeamMembers(context.Background(), &team.GetTeamMembersQuery{
		OrgID:  e.provisioned.OrgID,
		TeamID: teamID,
		// Listing members is filtered by org.users:read. The write under test is not.
		SignedInUser: &user.SignedInUser{
			OrgID: e.provisioned.OrgID,
			Permissions: map[int64]map[string][]string{
				e.provisioned.OrgID: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}},
			},
		},
	})
	require.NoError(t, err)
	got := make(map[int64]team.PermissionType, len(members))
	for _, member := range members {
		got[member.UserID] = member.Permission
	}
	return got
}

func (e *provisionedTeamEnv) serverFor(t *testing.T, writeScope string) *web.Mux {
	t.Helper()
	permissions := accesscontrol.GroupScopesByActionContext(context.Background(), []accesscontrol.Permission{
		{Action: accesscontrol.ActionTeamsPermissionsWrite, Scope: writeScope},
	})
	signedIn := &user.SignedInUser{
		UserID:      e.caller.ID,
		OrgID:       e.caller.OrgID,
		Login:       e.caller.Login,
		Permissions: map[int64]map[string][]string{e.caller.OrgID: permissions},
	}

	server := web.New()
	server.Use(func(c *web.Context) {
		reqCtx := &contextmodel.ReqContext{
			Context:      c,
			SignedInUser: signedIn,
			IsSignedIn:   true,
			Logger:       log.New("test"),
		}
		c.Req = c.Req.WithContext(ctxkey.Set(c.Req.Context(), reqCtx))
	})
	e.routes.Register(server)
	return server
}

func createOrgUser(t *testing.T, userSvc user.Service, login string) *user.User {
	t.Helper()
	created, err := userSvc.Create(context.Background(), &user.CreateUserCommand{
		Login: login,
		Email: login + "@example.com",
		OrgID: 1,
	})
	require.NoError(t, err)
	require.Equal(t, int64(1), created.OrgID)
	return created
}

func createTeam(t *testing.T, teamSvc team.Service, name string, provisioned bool) team.Team {
	t.Helper()
	created, err := teamSvc.CreateTeam(context.Background(), &team.CreateTeamCommand{
		Name:          name,
		Email:         name + "@example.com",
		OrgID:         1,
		IsProvisioned: provisioned,
	})
	require.NoError(t, err)
	return created
}

// seedTeamMember inserts the membership the identity provider would have synced.
// It calls the same hook ProvideTeamPermissions registers, outside the HTTP route.
func seedTeamMember(t *testing.T, sql *sqlstore.SQLStore, orgID, teamID, userID int64, permission team.PermissionType) {
	t.Helper()
	dbHelper, err := legacysql.NewDatabaseProvider(sql)(context.Background())
	require.NoError(t, err)
	err = sql.WithTransactionalDbSession(context.Background(), func(sess *db.Session) error {
		return teamimpl.AddOrUpdateTeamMemberHook(dbHelper, sess, userID, orgID, teamID, false, permission)
	})
	require.NoError(t, err)
}

func setTeamRedirectFlag(t *testing.T, enabled bool) {
	t.Helper()
	provider, err := featuremgmt.CreateStaticProviderWithStandardFlags(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagKubernetesTeamsRedirect: {Key: featuremgmt.FlagKubernetesTeamsRedirect, Variants: map[string]any{"": enabled}},
	})
	require.NoError(t, err)
	require.NoError(t, openfeature.SetProviderAndWait(provider))
	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
	})
}
