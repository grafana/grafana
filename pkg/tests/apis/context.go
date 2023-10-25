package apis

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

	// Available groups
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
	resp := c.Get(GetParams{
		url:  "/apis",
		user: c.Org1.Viewer,
	})
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	require.NoError(c.t, err)

	groups := &metav1.APIGroupList{}
	err = json.Unmarshal(body, groups)
	require.NoError(c.t, err)
	for _, g := range groups.Groups {
		c.Groups[g.Name] = g
	}
	return c
}

type User struct {
	User     user.User
	password string
}

type GetParams struct {
	url  string
	user User
}

func (c K8sTestContext) Get(params GetParams) *http.Response {
	c.t.Helper()

	//fmtUrl := fmt.Sprintf("%s", params.url, params.page)
	resp, err := http.Get(c.getURL(params.url, params.user))
	require.NoError(c.t, err)

	return resp
}

type PostParams struct {
	path string
	body string
	user User
}

func (c K8sTestContext) Post(params PostParams) *http.Response {
	c.t.Helper()
	buf := bytes.NewReader([]byte(params.body))

	// nolint:gosec
	resp, err := http.Post(
		c.getURL(params.path, params.user),
		"application/json",
		buf,
	)
	require.NoError(c.t, err)

	return resp
}

func (c K8sTestContext) Put(params PostParams) *http.Response {
	c.t.Helper()
	buf := bytes.NewReader([]byte(params.body))

	req, err := http.NewRequest("PUT", c.getURL(params.path, params.user), buf)
	require.NoError(c.t, err)
	req.Header.Set("Content-Type", "application/json")
	r, err := http.DefaultClient.Do(req)
	require.NoError(c.t, err)
	return r
}

type PatchParams struct {
	url  string
	body string
	user User
}

func (c K8sTestContext) Patch(params PatchParams) *http.Response {
	c.t.Helper()

	req, err := http.NewRequest(http.MethodPatch, c.getURL(params.url, params.user), bytes.NewBuffer([]byte(params.body)))
	req.Header.Set("Content-Type", "application/json")
	require.NoError(c.t, err)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(c.t, err)
	require.NoError(c.t, err)

	return resp
}

type DeleteParams struct {
	url  string
	user User
}

func (c K8sTestContext) Delete(params DeleteParams) *http.Response {
	c.t.Helper()

	req, err := http.NewRequest("DELETE", c.getURL(params.url, params.user), nil)
	require.NoError(c.t, err)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(c.t, err)

	return resp
}

func (c K8sTestContext) getURL(path string, user User) string {
	c.t.Helper()

	addr := c.env.Server.HTTPServer.Listener.Addr()
	baseUrl := fmt.Sprintf("http://%s", addr)
	if user.User.Login != "" && user.password != "" {
		baseUrl = fmt.Sprintf("http://%s:%s@%s", user.User.Login, user.password, addr)
	}
	return fmt.Sprintf(
		"%s%s",
		baseUrl,
		path,
	)
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

	userSvc, err := userimpl.ProvideService(store,
		orgService, store.Cfg, nil, nil, quotaService,
		supportbundlestest.NewFakeBundleService())
	require.NoError(c.t, err)

	createUser := func(key string, role org.RoleType) User {
		user, err := userSvc.Create(context.Background(), &user.CreateUserCommand{
			DefaultOrgRole: string(role),
			Password:       key,
			Login:          fmt.Sprintf("%s%d", key, orgId),
			OrgID:          orgId,
		})
		require.NoError(c.t, err)
		require.Equal(c.t, orgId, user.OrgID)
		require.True(c.t, user.ID > 0)
		return User{
			User:     *user,
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
