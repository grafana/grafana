package correlations

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/require"
)

type errorResponseBody struct {
	Message string `json:"message"`
	Error   string `json:"error"`
}

type TestContext struct {
	env server.TestEnv
	t   *testing.T
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
	username string
	password string
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
	if user.username != "" && user.password != "" {
		baseUrl = fmt.Sprintf("http://%s:%s@%s", user.username, user.password, c.env.Server.HTTPServer.Listener.Addr())
	}

	return fmt.Sprintf(
		"%s%s",
		baseUrl,
		url,
	)
}

func (c TestContext) createUser(cmd user.CreateUserCommand) {
	c.t.Helper()

	c.env.SQLStore.Cfg.AutoAssignOrg = true
	c.env.SQLStore.Cfg.AutoAssignOrgId = 1

	_, err := c.env.SQLStore.CreateUser(context.Background(), cmd)
	require.NoError(c.t, err)
}

func (c TestContext) createDs(cmd *datasources.AddDataSourceCommand) {
	c.t.Helper()

	err := c.env.SQLStore.AddDataSource(context.Background(), cmd)
	require.NoError(c.t, err)
}

func (c TestContext) createCorrelation(cmd correlations.CreateCorrelationCommand) correlations.Correlation {
	c.t.Helper()
	correlation, err := c.env.Server.HTTPServer.CorrelationsService.CreateCorrelation(context.Background(), cmd)

	require.NoError(c.t, err)
	return correlation
}
