package dashboards

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/plugindashboards"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/retryer"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationDashboardQuota(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testDashboardQuota(t, []string{})
}

func TestIntegrationDashboardQuotaK8s(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testDashboardQuota(t, []string{featuremgmt.FlagKubernetesClientDashboardsFolders})
}

func testDashboardQuota(t *testing.T, featureToggles []string) {
	// enable quota and set low dashboard quota
	// Setup Grafana and its Database
	dashboardQuota := int64(1)
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous:     true,
		EnableQuota:          true,
		DashboardOrgQuota:    &dashboardQuota,
		EnableFeatureToggles: featureToggles,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	store, cfg := env.SQLStore, env.Cfg
	// Create user
	createUser(t, store, cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	t.Run("when quota limit doesn't exceed, importing a dashboard should succeed", func(t *testing.T) {
		// Import dashboard
		dashboardDataOne, err := simplejson.NewJson([]byte(`{"title":"just testing"}`))
		require.NoError(t, err)
		buf1 := &bytes.Buffer{}
		err = json.NewEncoder(buf1).Encode(dashboardimport.ImportDashboardRequest{
			Dashboard: dashboardDataOne,
		})
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/dashboards/import", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", buf1)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		dashboardDTO := &plugindashboards.PluginDashboard{}
		err = json.Unmarshal(b, dashboardDTO)
		require.NoError(t, err)
		require.EqualValues(t, 1, dashboardDTO.DashboardId)
	})

	t.Run("when quota limit exceeds importing a dashboard should fail", func(t *testing.T) {
		dashboardDataOne, err := simplejson.NewJson([]byte(`{"title":"just testing"}`))
		require.NoError(t, err)
		buf1 := &bytes.Buffer{}
		err = json.NewEncoder(buf1).Encode(dashboardimport.ImportDashboardRequest{
			Dashboard: dashboardDataOne,
		})
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/dashboards/import", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", buf1)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		require.JSONEq(t, `{"message":"Quota reached"}`, string(b))
	})
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

func TestIntegrationUpdatingProvisionionedDashboards(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	testUpdatingProvisionionedDashboards(t, []string{})
}

func TestIntegrationUpdatingProvisionionedDashboardsK8s(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	// will be the default in g12
	testUpdatingProvisionionedDashboards(t, []string{featuremgmt.FlagKubernetesClientDashboardsFolders})
}

func testUpdatingProvisionionedDashboards(t *testing.T, featureToggles []string) {
	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous:     true,
		EnableFeatureToggles: featureToggles,
	})

	provDashboardsDir := filepath.Join(dir, "conf", "provisioning", "dashboards")
	provDashboardsCfg := filepath.Join(provDashboardsDir, "dev.yaml")
	blob := []byte(fmt.Sprintf(`
apiVersion: 1

providers:
- name: 'provisioned dashboards'
  type: file
  allowUiUpdates: false
  options:
   path: %s`, provDashboardsDir))
	err := os.WriteFile(provDashboardsCfg, blob, 0644)
	require.NoError(t, err)
	input, err := os.ReadFile(filepath.Join("./home.json"))
	require.NoError(t, err)
	provDashboardFile := filepath.Join(provDashboardsDir, "home.json")
	err = os.WriteFile(provDashboardFile, input, 0644)
	require.NoError(t, err)
	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	store, cfg := env.SQLStore, env.Cfg
	// Create user
	createUser(t, store, cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	// give provisioner some time since we don't have a way to know when provisioning is complete
	// TODO https://github.com/grafana/grafana/issues/85617
	time.Sleep(1 * time.Second)

	type errorResponseBody struct {
		Message string `json:"message"`
	}

	t.Run("when provisioned directory is not empty, dashboard should be created", func(t *testing.T) {
		title := "Grafana Dev Overview & Home"
		dashboardList := &model.HitList{}

		retry := 0
		retries := 5
		// retry until the provisioned dashboard is ready
		err := retryer.Retry(func() (retryer.RetrySignal, error) {
			retry++
			u := fmt.Sprintf("http://admin:admin@%s/api/search?query=%s", grafanaListedAddr, url.QueryEscape(title))
			// nolint:gosec
			resp, err := http.Get(u)
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
			b, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			err = json.Unmarshal(b, dashboardList)
			require.NoError(t, err)
			if dashboardList.Len() == 0 {
				if retry >= retries {
					return retryer.FuncError, fmt.Errorf("max retries exceeded")
				}
				t.Log("Dashboard is not ready", "retry", retry)
				return retryer.FuncFailure, nil
			}
			return retryer.FuncComplete, nil
		}, retries, time.Millisecond*time.Duration(25), time.Second)
		require.NoError(t, err)

		var dashboardUID string
		var dashboardID int64
		for _, d := range *dashboardList {
			dashboardUID = d.UID
			dashboardID = d.ID
		}
		assert.Equal(t, int64(1), dashboardID)

		testCases := []struct {
			desc          string
			dashboardData string
			expStatus     int
			expErrReason  string
		}{
			{
				desc:          "when updating provisioned dashboard using ID it should fail",
				dashboardData: fmt.Sprintf(`{"title":"just testing", "id": %d, "version": 1}`, dashboardID),
				expStatus:     http.StatusBadRequest,
				expErrReason:  dashboards.ErrDashboardCannotSaveProvisionedDashboard.Reason,
			},
			{
				desc:          "when updating provisioned dashboard using UID it should fail",
				dashboardData: fmt.Sprintf(`{"title":"just testing", "uid": %q, "version": 1}`, dashboardUID),
				expStatus:     http.StatusBadRequest,
				expErrReason:  dashboards.ErrDashboardCannotSaveProvisionedDashboard.Reason,
			},
			{
				desc:          "when updating dashboard using unknown ID, it should fail",
				dashboardData: `{"title":"just testing", "id": 42, "version": 1}`,
				expStatus:     http.StatusNotFound,
				expErrReason:  dashboards.ErrDashboardNotFound.Reason,
			},
			{
				desc:          "when updating dashboard using unknown UID, it should succeed",
				dashboardData: `{"title":"just testing", "uid": "unknown", "version": 1}`,
				expStatus:     http.StatusOK,
			},
		}
		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				u := fmt.Sprintf("http://admin:admin@%s/api/dashboards/db", grafanaListedAddr)
				// nolint:gosec
				dashboardData, err := simplejson.NewJson([]byte(tc.dashboardData))
				require.NoError(t, err)
				buf := &bytes.Buffer{}
				err = json.NewEncoder(buf).Encode(dashboards.SaveDashboardCommand{
					Dashboard: dashboardData,
				})
				require.NoError(t, err)

				// nolint:gosec
				resp, err := http.Post(u, "application/json", buf)
				require.NoError(t, err)
				assert.Equal(t, tc.expStatus, resp.StatusCode)
				t.Cleanup(func() {
					err := resp.Body.Close()
					require.NoError(t, err)
				})
				if tc.expErrReason == "" {
					return
				}
				b, err := io.ReadAll(resp.Body)
				require.NoError(t, err)
				dashboardErr := &errorResponseBody{}
				err = json.Unmarshal(b, dashboardErr)
				require.NoError(t, err)
				assert.Equal(t, tc.expErrReason, dashboardErr.Message)
			})
		}

		t.Run("deleting provisioned dashboard should fail", func(t *testing.T) {
			u := fmt.Sprintf("http://admin:admin@%s/api/dashboards/uid/%s", grafanaListedAddr, dashboardUID)
			req, err := http.NewRequest("DELETE", u, nil)
			if err != nil {
				fmt.Println(err)
				return
			}

			client := &http.Client{}
			resp, err := client.Do(req)
			require.NoError(t, err)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
			assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

			b, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			dashboardErr := &errorResponseBody{}
			err = json.Unmarshal(b, dashboardErr)
			require.NoError(t, err)
			assert.Equal(t, dashboards.ErrDashboardCannotDeleteProvisionedDashboard.Reason, dashboardErr.Message)
		})
	})
}

func TestIntegrationCreate(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	testCreate(t, []string{})
}

func TestIntegrationCreateK8s(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	testCreate(t, []string{featuremgmt.FlagKubernetesClientDashboardsFolders})
}

func testCreate(t *testing.T, featureToggles []string) {
	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous:     true,
		EnableFeatureToggles: featureToggles,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	store, cfg := env.SQLStore, env.Cfg
	// Create user
	createUser(t, store, cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	t.Run("create dashboard should succeed", func(t *testing.T) {
		dashboardDataOne, err := simplejson.NewJson([]byte(`{"title":"just testing"}`))
		require.NoError(t, err)
		buf1 := &bytes.Buffer{}
		err = json.NewEncoder(buf1).Encode(dashboards.SaveDashboardCommand{
			Dashboard: dashboardDataOne,
		})
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/dashboards/db", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", buf1)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var m util.DynMap
		err = json.Unmarshal(b, &m)
		require.NoError(t, err)
		assert.NotEmpty(t, m["id"])
		assert.NotEmpty(t, m["uid"])
	})

	t.Run("create dashboard under folder should succeed", func(t *testing.T) {
		folder := createFolder(t, grafanaListedAddr, "test folder")

		dashboardDataOne, err := simplejson.NewJson([]byte(`{"title":"just testing"}`))
		require.NoError(t, err)
		buf1 := &bytes.Buffer{}
		err = json.NewEncoder(buf1).Encode(dashboards.SaveDashboardCommand{
			Dashboard: dashboardDataOne,
			OrgID:     0,
			FolderUID: folder.UID,
		})
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/dashboards/db", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", buf1)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var m util.DynMap
		err = json.Unmarshal(b, &m)
		require.NoError(t, err)
		assert.NotEmpty(t, m["id"])
		assert.NotEmpty(t, m["uid"])
		assert.Equal(t, folder.UID, m["folderUid"])
	})

	t.Run("create dashboard under folder (using deprecated folder sequential ID) should succeed", func(t *testing.T) {
		folder := createFolder(t, grafanaListedAddr, "test folder 2")

		dashboardDataOne, err := simplejson.NewJson([]byte(`{"title":"just testing"}`))
		require.NoError(t, err)
		buf1 := &bytes.Buffer{}
		err = json.NewEncoder(buf1).Encode(dashboards.SaveDashboardCommand{
			Dashboard: dashboardDataOne,
			OrgID:     0,
			FolderUID: folder.UID,
		})
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/dashboards/db", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", buf1)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var m util.DynMap
		err = json.Unmarshal(b, &m)
		require.NoError(t, err)
		assert.NotEmpty(t, m["id"])
		assert.NotEmpty(t, m["uid"])
		assert.Equal(t, folder.UID, m["folderUid"])
	})

	t.Run("create dashboard under unknow folder should fail", func(t *testing.T) {
		folderUID := "unknown"
		// Import dashboard
		dashboardDataOne, err := simplejson.NewJson([]byte(`{"title":"just testing"}`))
		require.NoError(t, err)
		buf1 := &bytes.Buffer{}
		err = json.NewEncoder(buf1).Encode(dashboards.SaveDashboardCommand{
			Dashboard: dashboardDataOne,
			FolderUID: folderUID,
		})
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/dashboards/db", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", buf1)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var m util.DynMap
		err = json.Unmarshal(b, &m)
		require.NoError(t, err)
		assert.Equal(t, dashboards.ErrFolderNotFound.Error(), m["message"])
	})
}

func createFolder(t *testing.T, grafanaListedAddr string, title string) *dtos.Folder {
	t.Helper()

	buf1 := &bytes.Buffer{}
	err := json.NewEncoder(buf1).Encode(folder.CreateFolderCommand{
		Title: title,
	})
	require.NoError(t, err)
	u := fmt.Sprintf("http://admin:admin@%s/api/folders", grafanaListedAddr)
	// nolint:gosec
	resp, err := http.Post(u, "application/json", buf1)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	t.Cleanup(func() {
		err := resp.Body.Close()
		require.NoError(t, err)
	})
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var f *dtos.Folder
	err = json.Unmarshal(b, &f)
	require.NoError(t, err)

	return f
}
