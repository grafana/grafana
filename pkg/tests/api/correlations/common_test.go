package correlations

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/require"
)

type TestContext struct {
	env server.TestEnv
	t   *testing.T
}

func NewTestEnv(t *testing.T) TestContext {
	t.Helper()
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{})
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
	baseUrl := fmt.Sprintf("http://%s", c.env.Server.HTTPServer.Listener.Addr())
	if params.user.username != "" && params.user.password != "" {
		baseUrl = fmt.Sprintf("http://%s:%s@%s", params.user.username, params.user.password, c.env.Server.HTTPServer.Listener.Addr())
	}

	// nolint:gosec
	resp, err := http.Post(
		fmt.Sprintf(
			"%s%s",
			baseUrl,
			params.url,
		),
		"application/json",
		buf,
	)
	require.NoError(c.t, err)
	c.t.Cleanup(func() {
		require.NoError(c.t, resp.Body.Close())
	})

	return resp
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

	c.env.SQLStore.Cfg.AutoAssignOrg = true
	c.env.SQLStore.Cfg.AutoAssignOrgId = 1

	err := c.env.SQLStore.AddDataSource(context.Background(), cmd)
	require.NoError(c.t, err)
}
