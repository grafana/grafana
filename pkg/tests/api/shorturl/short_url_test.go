package shorturl

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestShortURL(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		AppModeProduction: true,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	username, password := "viewer", "viewer"
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       user.Password(password),
		Login:          username,
	})

	c := client(grafanaListedAddr, username, password)

	// Create a valid short-urls
	res, err := c.post("/api/short-urls", bytes.NewReader([]byte(`{"path":"explore"}`)))
	require.NoError(t, err)
	defer func() {
		_ = res.Body.Close()
	}()
	require.Equal(t, http.StatusOK, res.StatusCode)

	bodyRaw, err := io.ReadAll(res.Body)
	require.NoError(t, err)

	resParsed := struct {
		UID string `json:"uid"`
	}{}
	err = json.Unmarshal(bodyRaw, &resParsed)
	require.NoError(t, err)

	// If the go-to exists, it should be set in the location and the status should match 302.
	res, err = c.get(fmt.Sprintf("/goto/%s", resParsed.UID))
	require.NoError(t, err)
	defer func() {
		_ = res.Body.Close()
	}()
	require.Equal(t, "http://localhost:3000/explore", res.Header.Get("Location"))
	require.Equal(t, http.StatusFound, res.StatusCode)

	// If the go-to does not exist, it should redirect to the home page and return 308.
	res, err = c.get("/goto/DoesNotExist")
	require.NoError(t, err)
	defer func() {
		_ = res.Body.Close()
	}()
	require.Equal(t, "http://localhost:3000/", res.Header.Get("Location"))
	require.Equal(t, http.StatusPermanentRedirect, res.StatusCode)
}

func createUser(t *testing.T, db db.DB, cfg *setting.Cfg, cmd user.CreateUserCommand) int64 {
	t.Helper()

	cfg.AutoAssignOrg = true
	cfg.AutoAssignOrgId = 1

	quotaService := quotaimpl.ProvideService(db, cfg)
	orgService, err := orgimpl.ProvideService(db, cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(
		db, orgService, cfg, nil, nil, tracing.InitializeTracerForTest(),
		quotaService, supportbundlestest.NewFakeBundleService(),
	)
	require.NoError(t, err)

	u, err := usrSvc.Create(context.Background(), &cmd)
	require.NoError(t, err)
	return u.ID
}

type apiClient struct {
	url string
}

func client(host, user, pass string) apiClient {
	if len(user) == 0 && len(pass) == 0 {
		return apiClient{url: fmt.Sprintf("http://%s", host)}
	}
	return apiClient{url: fmt.Sprintf("http://%s:%s@%s", user, pass, host)}
}

func (a apiClient) get(path string) (*http.Response, error) {
	u := fmt.Sprintf("%s%s", a.url, path)
	// Setup a client that doesn't follow redirects.
	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	// nolint:gosec
	return client.Get(u)
}

func (a apiClient) post(path string, body io.Reader) (*http.Response, error) {
	u := fmt.Sprintf("%s%s", a.url, path)
	// nolint:gosec
	return http.Post(u, "application/json", body)
}
