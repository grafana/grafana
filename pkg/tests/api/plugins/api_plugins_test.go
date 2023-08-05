package plugins

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

const (
	usernameAdmin    = "admin"
	usernameNonAdmin = "nonAdmin"
	defaultPassword  = "password"
)

var updateSnapshotFlag = false

func TestIntegrationPlugins(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	dir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		PluginAdminEnabled: true,
	})

	origBuildVersion := setting.BuildVersion
	setting.BuildVersion = "0.0.0-test"
	t.Cleanup(func() {
		setting.BuildVersion = origBuildVersion
	})

	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, cfgPath)

	type testCase struct {
		desc        string
		url         string
		expStatus   int
		expRespPath string
	}

	t.Run("Install", func(t *testing.T) {
		createUser(t, store, user.CreateUserCommand{Login: usernameNonAdmin, Password: defaultPassword, IsAdmin: false})
		createUser(t, store, user.CreateUserCommand{Login: usernameAdmin, Password: defaultPassword, IsAdmin: true})

		t.Run("Request is forbidden if not from an admin", func(t *testing.T) {
			status, body := makePostRequest(t, grafanaAPIURL(usernameNonAdmin, grafanaListedAddr, "plugins/grafana-plugin/install"))
			assert.Equal(t, 403, status)
			assert.Equal(t, "You'll need additional permissions to perform this action. Permissions needed: plugins:install", body["message"])

			status, body = makePostRequest(t, grafanaAPIURL(usernameNonAdmin, grafanaListedAddr, "plugins/grafana-plugin/uninstall"))
			assert.Equal(t, 403, status)
			assert.Equal(t, "You'll need additional permissions to perform this action. Permissions needed: plugins:install", body["message"])
		})

		t.Run("Request is not forbidden if from an admin", func(t *testing.T) {
			statusCode, body := makePostRequest(t, grafanaAPIURL(usernameAdmin, grafanaListedAddr, "plugins/test/install"))

			assert.Equal(t, 404, statusCode)
			assert.Equal(t, "Plugin not found", body["message"])

			statusCode, body = makePostRequest(t, grafanaAPIURL(usernameAdmin, grafanaListedAddr, "plugins/test/uninstall"))
			assert.Equal(t, 404, statusCode)
			assert.Equal(t, "Plugin not installed", body["message"])
		})
	})

	//
	// NOTE:
	// If this test is failing due to changes in plugins just rerun with updateSnapshotFlag = true at the top.
	//
	t.Run("List", func(t *testing.T) {
		testCases := []testCase{
			{
				desc:        "should return all loaded core and bundled plugins",
				url:         "http://%s/api/plugins",
				expStatus:   http.StatusOK,
				expRespPath: "expectedListResp.json",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				url := fmt.Sprintf(tc.url, grafanaListedAddr)
				// nolint:gosec
				resp, err := http.Get(url)
				t.Cleanup(func() {
					require.NoError(t, resp.Body.Close())
				})
				require.NoError(t, err)
				require.Equal(t, tc.expStatus, resp.StatusCode)
				b, err := io.ReadAll(resp.Body)
				require.NoError(t, err)

				expResp := expectedResp(t, tc.expRespPath)

				same := assert.JSONEq(t, expResp, string(b))
				if !same {
					if updateSnapshotFlag {
						t.Log("updating snapshot results")
						var prettyJSON bytes.Buffer
						if err := json.Indent(&prettyJSON, b, "", "  "); err != nil {
							t.FailNow()
						}
						updateRespSnapshot(t, tc.expRespPath, prettyJSON.String())
					}
					t.FailNow()
				}
			})
		}
	})
}

func TestIntegrationPluginAssets(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	type testCase struct {
		desc            string
		url             string
		env             string
		expStatus       int
		expCacheControl string
	}
	t.Run("Assets", func(t *testing.T) {
		testCases := []testCase{
			{
				desc:            "should return no-cache settings for Dev env",
				env:             setting.Dev,
				url:             "http://%s/public/plugins/testdata/img/testdata.svg",
				expStatus:       http.StatusOK,
				expCacheControl: "max-age=0, must-revalidate, no-cache",
			},
			{
				desc:            "should return cache settings for Prod env",
				env:             setting.Prod,
				url:             "http://%s/public/plugins/testdata/img/testdata.svg",
				expStatus:       http.StatusOK,
				expCacheControl: "public, max-age=3600",
			},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				dir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
					AppModeProduction: tc.env == setting.Prod,
				})

				grafanaListedAddr, _ := testinfra.StartGrafana(t, dir, cfgPath)
				url := fmt.Sprintf(tc.url, grafanaListedAddr)
				// nolint:gosec
				resp, err := http.Get(url)
				t.Cleanup(func() {
					require.NoError(t, resp.Body.Close())
				})
				require.NoError(t, err)
				require.Equal(t, tc.expStatus, resp.StatusCode)
				require.Equal(t, tc.expCacheControl, resp.Header.Get("Cache-Control"))
			})
		}
	})
}

func createUser(t *testing.T, store *sqlstore.SQLStore, cmd user.CreateUserCommand) {
	t.Helper()

	store.Cfg.AutoAssignOrg = true
	store.Cfg.AutoAssignOrgId = 1

	quotaService := quotaimpl.ProvideService(store, store.Cfg)
	orgService, err := orgimpl.ProvideService(store, store.Cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(store, orgService, store.Cfg, nil, nil, quotaService, supportbundlestest.NewFakeBundleService())
	require.NoError(t, err)

	_, err = usrSvc.Create(context.Background(), &cmd)
	require.NoError(t, err)
}

func makePostRequest(t *testing.T, URL string) (int, map[string]interface{}) {
	t.Helper()

	// nolint:gosec
	resp, err := http.Post(URL, "application/json", bytes.NewBufferString(""))
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, resp.Body.Close())
	})
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	var body = make(map[string]interface{})
	err = json.Unmarshal(b, &body)
	require.NoError(t, err)

	return resp.StatusCode, body
}

func grafanaAPIURL(username string, grafanaListedAddr string, path string) string {
	return fmt.Sprintf("http://%s:%s@%s/api/%s", username, defaultPassword, grafanaListedAddr, path)
}

func expectedResp(t *testing.T, filename string) string {
	//nolint:GOSEC
	contents, err := os.ReadFile(filepath.Join("data", filename))
	if err != nil {
		t.Errorf("failed to load %s: %v", filename, err)
	}

	return string(contents)
}

func updateRespSnapshot(t *testing.T, filename string, body string) {
	err := os.WriteFile(filepath.Join("data", filename), []byte(body), 0600)
	if err != nil {
		t.Errorf("error writing snapshot %s: %v", filename, err)
	}
}
