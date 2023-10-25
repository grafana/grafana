package apis

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

type TestUsers struct {
	Admin  User
	Editor User
	Viewer User
}

type K8sTestContext struct {
	t   *testing.T
	env server.TestEnv

	Org1 TestUsers
	Org2 TestUsers

	// Registered groups
	Groups map[string]metav1.APIGroup
}

func NewK8sTestContext(t *testing.T) K8sTestContext {
	t.Helper()
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		AppModeProduction: true, // do not start extra port 6443
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServer,
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
		},
	})
	_, env := testinfra.StartGrafanaEnv(t, dir, path)
	c := K8sTestContext{
		env:    *env,
		t:      t,
		Groups: make(map[string]metav1.APIGroup),
	}

	c.Org1 = c.createTestUsers(int64(1))
	c.Org2 = c.createTestUsers(int64(2))

	// Read the groups
	rsp := newK8sResponse(c.Request(RequestParams{
		User: c.Org1.Viewer,
		Path: "/apis",
	}), &metav1.APIGroupList{})
	for _, g := range rsp.Result.Groups {
		c.Groups[g.Name] = g
	}
	return c
}

type User struct {
	Identity identity.Requester
	password string
}

type RequestParams struct {
	User        User
	Method      string // GET/POST
	Path        string
	Body        []byte
	ContentType string
}

func (c K8sTestContext) Request(params RequestParams) *http.Response {
	c.t.Helper()

	if params.Method == "" {
		params.Method = http.MethodGet
	}

	// Get the URL
	addr := c.env.Server.HTTPServer.Listener.Addr()
	baseUrl := fmt.Sprintf("http://%s", addr)
	login := params.User.Identity.GetLogin()
	if login != "" && params.User.password != "" {
		baseUrl = fmt.Sprintf("http://%s:%s@%s", login, params.User.password, addr)
	}

	contentType := params.ContentType
	var body io.Reader
	if params.Body != nil {
		body = bytes.NewReader([]byte(params.Body))
		if contentType == "" && json.Valid(params.Body) {
			contentType = "application/json"
		}
	}

	req, err := http.NewRequest("PUT", fmt.Sprintf(
		"%s%s",
		baseUrl,
		body,
	), body)
	require.NoError(c.t, err)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	r, err := http.DefaultClient.Do(req)
	require.NoError(c.t, err)
	return r
}

func (c K8sTestContext) createTestUsers(orgId int64) TestUsers {
	c.t.Helper()

	store := c.env.SQLStore
	store.Cfg.AutoAssignOrg = true
	store.Cfg.AutoAssignOrgId = int(orgId)
	quotaService := quotaimpl.ProvideService(store, store.Cfg)

	orgService, err := orgimpl.ProvideService(store, store.Cfg, quotaService)
	require.NoError(c.t, err)

	gotID, err := orgService.GetOrCreate(context.Background(), fmt.Sprintf("Org%d", orgId))
	require.NoError(c.t, err)
	require.Equal(c.t, orgId, gotID)

	teamSvc := teamimpl.ProvideService(store, store.Cfg)
	cache := localcache.ProvideService()
	userSvc, err := userimpl.ProvideService(store,
		orgService, store.Cfg, teamSvc, cache, quotaService,
		supportbundlestest.NewFakeBundleService())
	require.NoError(c.t, err)

	createUser := func(key string, role org.RoleType) User {
		u, err := userSvc.Create(context.Background(), &user.CreateUserCommand{
			DefaultOrgRole: string(role),
			Password:       key,
			Login:          fmt.Sprintf("%s%d", key, orgId),
			OrgID:          orgId,
		})
		require.NoError(c.t, err)
		require.Equal(c.t, orgId, u.OrgID)
		require.True(c.t, u.ID > 0)

		s, err := userSvc.GetSignedInUser(context.Background(), &user.GetSignedInUserQuery{
			UserID: u.ID,
			Login:  u.Login,
			Email:  u.Email,
			OrgID:  orgId,
		})
		require.NoError(c.t, err)
		require.Equal(c.t, orgId, s.OrgID)
		require.Equal(c.t, role, s.OrgRole) // make sure the role was set properly
		return User{
			Identity: s,
			password: key,
		}
	}
	return TestUsers{
		Admin:  createUser("admin", org.RoleAdmin),
		Editor: createUser("editor", org.RoleEditor),
		Viewer: createUser("viewer", org.RoleViewer),
	}
}

func (c K8sTestContext) CreateDS(cmd *datasources.AddDataSourceCommand) *datasources.DataSource {
	c.t.Helper()

	dataSource, err := c.env.Server.HTTPServer.DataSourcesService.AddDataSource(context.Background(), cmd)
	require.NoError(c.t, err)
	return dataSource
}
