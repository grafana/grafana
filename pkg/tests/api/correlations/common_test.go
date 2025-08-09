package correlations

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

type errorResponseBody struct {
	Message string `json:"message"`
	Error   string `json:"error"`
}

type TestContext struct {
	env server.TestEnv
	t   *testing.T
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func NewTestEnv(t *testing.T) TestContext {
	t.Helper()
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})
	_, env := testinfra.StartGrafanaEnv(t, dir, path)

	return TestContext{
		env: *env,
		t:   t,
	}
}

type User struct {
	User     user.User
	password user.Password
}

type GetParams struct {
	url  string
	user User
	page string
}

func (c TestContext) Get(params GetParams) *http.Response {
	c.t.Helper()
	fmtUrl := fmt.Sprintf("%s?page=%s", params.url, params.page)
	resp, err := http.Get(c.getURL(fmtUrl, params.user))
	require.NoError(c.t, err)

	return resp
}

type PostParams struct {
	url  string
	body string
	user User
}

func (c TestContext) Post(params PostParams) *http.Response {
	c.t.Helper()
	buf := bytes.NewReader([]byte(params.body))

	// nolint:gosec
	resp, err := http.Post(
		c.getURL(params.url, params.user),
		"application/json",
		buf,
	)
	require.NoError(c.t, err)

	return resp
}

type PatchParams struct {
	url  string
	body string
	user User
}

func (c TestContext) Patch(params PatchParams) *http.Response {
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

func (c TestContext) Delete(params DeleteParams) *http.Response {
	c.t.Helper()

	req, err := http.NewRequest("DELETE", c.getURL(params.url, params.user), nil)
	require.NoError(c.t, err)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(c.t, err)

	return resp
}

func (c TestContext) getURL(url string, user User) string {
	c.t.Helper()

	baseUrl := fmt.Sprintf("http://%s", c.env.Server.HTTPServer.Listener.Addr())
	if user.User.Login != "" && user.password != "" {
		baseUrl = fmt.Sprintf("http://%s:%s@%s", user.User.Login, user.password, c.env.Server.HTTPServer.Listener.Addr())
	}

	return fmt.Sprintf(
		"%s%s",
		baseUrl,
		url,
	)
}

func (c TestContext) createOrg(name string) int64 {
	c.t.Helper()
	store := c.env.SQLStore
	c.env.Cfg.AutoAssignOrg = false
	cfgProvider, err := configprovider.ProvideService(c.env.Cfg)
	require.NoError(c.t, err)
	quotaService := quotaimpl.ProvideService(store, cfgProvider)
	orgService, err := orgimpl.ProvideService(store, c.env.Cfg, quotaService)
	require.NoError(c.t, err)
	orgId, err := orgService.GetOrCreate(context.Background(), name)
	require.NoError(c.t, err)
	return orgId
}

func (c TestContext) createUser(cmd user.CreateUserCommand) User {
	c.t.Helper()
	store := c.env.SQLStore
	c.env.Cfg.AutoAssignOrg = true
	c.env.Cfg.AutoAssignOrgId = 1

	cfgProvider, err := configprovider.ProvideService(c.env.Cfg)
	require.NoError(c.t, err)
	quotaService := quotaimpl.ProvideService(store, cfgProvider)
	orgService, err := orgimpl.ProvideService(store, c.env.Cfg, quotaService)
	require.NoError(c.t, err)
	usrSvc, err := userimpl.ProvideService(
		store, orgService, c.env.Cfg, nil, nil, tracing.InitializeTracerForTest(),
		quotaService, supportbundlestest.NewFakeBundleService(),
	)
	require.NoError(c.t, err)

	user, err := usrSvc.Create(context.Background(), &cmd)
	require.NoError(c.t, err)

	return User{
		User:     *user,
		password: cmd.Password,
	}
}

func (c TestContext) createDs(cmd *datasources.AddDataSourceCommand) *datasources.DataSource {
	c.t.Helper()

	dataSource, err := c.env.Server.HTTPServer.DataSourcesService.AddDataSource(context.Background(), cmd)
	require.NoError(c.t, err)
	return dataSource
}

func (c TestContext) createCorrelation(cmd correlations.CreateCorrelationCommand) correlations.Correlation {
	c.t.Helper()
	correlation, err := c.env.Server.HTTPServer.CorrelationsService.CreateCorrelation(context.Background(), cmd)

	require.NoError(c.t, err)
	return correlation
}

func (c TestContext) createCorrelationPassError(cmd correlations.CreateCorrelationCommand) (correlations.Correlation, error) {
	c.t.Helper()
	return c.env.Server.HTTPServer.CorrelationsService.CreateCorrelation(context.Background(), cmd)
}

func (c TestContext) createOrUpdateCorrelation(cmd correlations.CreateCorrelationCommand) {
	c.t.Helper()
	err := c.env.Server.HTTPServer.CorrelationsService.CreateOrUpdateCorrelation(context.Background(), cmd)

	require.NoError(c.t, err)
}
