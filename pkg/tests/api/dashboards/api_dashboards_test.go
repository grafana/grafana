package dashboards

import (
	"bytes"
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
	"github.com/grafana/grafana/pkg/services/dashboardimport"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/plugindashboards"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationDashboardServiceValidation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})
	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	orgPayload := map[string]interface{}{
		"name": "Org B",
	}
	orgPayloadBytes, err := json.Marshal(orgPayload)
	require.NoError(t, err)

	orgURL := fmt.Sprintf("http://admin:admin@%s/api/orgs", grafanaListedAddr)
	orgResp, err := http.Post(orgURL, "application/json", bytes.NewBuffer(orgPayloadBytes)) // nolint:gosec
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, orgResp.StatusCode)
	err = orgResp.Body.Close()
	require.NoError(t, err)

	tests.CreateUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Login:          "admin-org2",
		Password:       "admin",
		IsAdmin:        true,
		OrgID:          2,
	}, grafanaListedAddr)

	savedFolder := createFolder(t, grafanaListedAddr, "Saved folder")
	savedDashInFolder := createDashboard(t, grafanaListedAddr, "Saved dash in folder", savedFolder.ID, savedFolder.UID) // nolint:staticcheck
	savedDashInGeneralFolder := createDashboard(t, grafanaListedAddr, "Saved dashboard in general folder", 0, "")

	t.Run("When saving a dashboard with non-existing id in org A", func(t *testing.T) {
		resp, err := postDashboard(t, grafanaListedAddr, "admin", "admin", map[string]interface{}{
			"dashboard": map[string]interface{}{
				"id":    123412321,
				"title": "Expect error",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)
	})

	t.Run("When saving a dashboard with existing ID from org A in org B", func(t *testing.T) {
		resp, err := postDashboard(t, grafanaListedAddr, "admin-org2", "admin", map[string]interface{}{
			"dashboard": map[string]interface{}{
				"id":    savedDashInFolder.ID, // nolint:staticcheck
				"title": "Expect error",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)
	})

	t.Run("When saving a dashboard with same UID in org A and org B, should be okay", func(t *testing.T) {
		resp, err := postDashboard(t, grafanaListedAddr, "admin-org2", "admin", map[string]interface{}{
			"dashboard": map[string]interface{}{
				"uid":   savedDashInFolder.UID,
				"title": "Saved dash in folder",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)
	})

	t.Run("When creating a dashboard in General folder with same name as dashboard in other folder", func(t *testing.T) {
		resp, err := postDashboard(t, grafanaListedAddr, "admin", "admin", map[string]interface{}{
			"dashboard": map[string]interface{}{
				"title": "Saved dash in folder",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)
	})
	t.Run("When creating a dashboard in other folder with same name as dashboard in General folder", func(t *testing.T) {
		resp, err := postDashboard(t, grafanaListedAddr, "admin", "admin", map[string]interface{}{
			"dashboard": map[string]interface{}{
				"uid":   savedDashInFolder,
				"title": "Dash with existing uid in other org",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)
	})

	t.Run("When creating a folder with same name as dashboard in other folder", func(t *testing.T) {
		f := createFolder(t, grafanaListedAddr, "Saved dashboard in general folder")
		require.Equal(t, f.Title, "Saved dashboard in general folder")
	})

	t.Run("When saving a dashboard without id and uid and unique title in folder", func(t *testing.T) {
		resp, err := postDashboard(t, grafanaListedAddr, "admin", "admin", map[string]interface{}{
			"dashboard": map[string]interface{}{
				"title": "Unique",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)
	})

	t.Run("When saving a dashboard with id 0", func(t *testing.T) {
		resp, err := postDashboard(t, grafanaListedAddr, "admin", "admin", map[string]interface{}{
			"dashboard": map[string]interface{}{
				"id":    0,
				"title": "Dash with zero id",
			},
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)
	})

	t.Run("When saving a dashboard in non-existing folder", func(t *testing.T) {
		resp, err := postDashboard(t, grafanaListedAddr, "admin", "admin", map[string]interface{}{
			"dashboard": map[string]interface{}{
				"title": "no folder",
			},
			"folderUid": "non-existing-folder",
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)
	})

	t.Run("When saving a dashboard with incorrect version but no overwrite", func(t *testing.T) {
		resp, err := postDashboard(t, grafanaListedAddr, "admin", "admin", map[string]interface{}{
			"dashboard": map[string]interface{}{
				"uid":     savedDashInFolder.UID,
				"version": 1,
			},
			"folderUid": savedDashInFolder.FolderUID,
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)
	})

	t.Run("When saving a dashboard with current version and overwrite is true", func(t *testing.T) {
		resp, err := postDashboard(t, grafanaListedAddr, "admin", "admin", map[string]interface{}{
			"dashboard": map[string]interface{}{
				"uid":     savedDashInFolder.UID,
				"version": savedDashInFolder.Version,
				"title":   "Saved dash in folder",
			},
			"folderUid": savedDashInFolder.FolderUID,
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)
	})

	t.Run("When saving a dashboard with no version set and title set to a folder title", func(t *testing.T) {
		resp, err := postDashboard(t, grafanaListedAddr, "admin", "admin", map[string]interface{}{
			"dashboard": map[string]interface{}{
				"uid":   savedDashInFolder.UID,
				"title": "Saved folder",
			},
			"folderUid": savedDashInFolder.FolderUID,
			"overwrite": true,
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)
	})

	t.Run("When updating uid with id", func(t *testing.T) {
		resp, err := postDashboard(t, grafanaListedAddr, "admin", "admin", map[string]interface{}{
			"dashboard": map[string]interface{}{
				"id":    savedDashInFolder.ID, // nolint:staticcheck
				"uid":   "new-uid",
				"title": "Updated title",
			},
			"folderUid": savedDashInFolder.FolderUID,
			"overwrite": true,
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)
	})
	t.Run("When updating uid with a dashboard already using that uid", func(t *testing.T) {
		resp, err := postDashboard(t, grafanaListedAddr, "admin", "admin", map[string]interface{}{
			"dashboard": map[string]interface{}{
				"id":    savedDashInFolder.ID, // nolint:staticcheck
				"uid":   savedDashInGeneralFolder.UID,
				"title": "Updated title",
			},
			"folderUid": savedDashInFolder.FolderUID,
			"overwrite": true,
		})
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)
	})

	t.Run("When trying to update to a folder", func(t *testing.T) {
		resp, err := postDashboard(t, grafanaListedAddr, "admin", "admin", map[string]interface{}{
			"dashboard": map[string]interface{}{
				"id":    savedDashInFolder.ID, // nolint:staticcheck
				"uid":   savedDashInFolder.UID,
				"title": "Updated title",
			},
			"isFolder":  true,
			"folderUid": savedDashInFolder.FolderUID,
			"overwrite": true,
		})
		require.NoError(t, err)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)
	})
}

func TestIntegrationDashboardQuota(t *testing.T) {
	// enable quota and set low dashboard quota
	// Setup Grafana and its Database
	dashboardQuota := int64(1)
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous:  true,
		EnableQuota:       true,
		DashboardOrgQuota: &dashboardQuota,
	})

	grafanaListedAddr, _ := testinfra.StartGrafanaEnv(t, dir, path)

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

func TestIntegrationUpdatingProvisionionedDashboards(t *testing.T) {
	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
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
	grafanaListedAddr, _ := testinfra.StartGrafanaEnv(t, dir, path)

	// give provisioner some time since we don't have a way to know when provisioning is complete
	// TODO https://github.com/grafana/grafana/issues/85617
	time.Sleep(1 * time.Second)

	type errorResponseBody struct {
		Message string `json:"message"`
	}

	t.Run("when provisioned directory is not empty, dashboard should be created", func(t *testing.T) {
		title := "Grafana Dev Overview & Home"
		dashboardList := &model.HitList{}

		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			u := fmt.Sprintf("http://admin:admin@%s/api/search?query=%s", grafanaListedAddr, url.QueryEscape(title))
			// nolint:gosec
			resp, err := http.Get(u)
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)

			b, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			err = resp.Body.Close()
			require.NoError(t, err)

			err = json.Unmarshal(b, dashboardList)
			require.NoError(t, err)

			assert.Greater(collect, dashboardList.Len(), 0, "Dashboard should be ready")
		}, 10*time.Second, 25*time.Millisecond)

		var dashboardUID string
		var dashboardID int64
		for _, d := range *dashboardList {
			dashboardUID = d.UID
			dashboardID = d.ID // nolint:staticcheck
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
	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})

	grafanaListedAddr, _ := testinfra.StartGrafanaEnv(t, dir, path)

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

func intPtr(n int) *int {
	return &n
}

func TestIntegrationPreserveSchemaVersion(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})

	grafanaListedAddr, _ := testinfra.StartGrafanaEnv(t, dir, path)

	schemaVersions := []*int{intPtr(1), intPtr(36), intPtr(40), nil}
	for _, schemaVersion := range schemaVersions {
		var title string
		if schemaVersion == nil {
			title = "save dashboard with no schemaVersion"
		} else {
			title = fmt.Sprintf("save dashboard with schemaVersion %d", *schemaVersion)
		}

		t.Run(title, func(t *testing.T) {
			// Create dashboard JSON with specified schema version
			var dashboardJSON string
			if schemaVersion != nil {
				dashboardJSON = fmt.Sprintf(`{"title":"Schema Version Test", "schemaVersion": %d}`, *schemaVersion)
			} else {
				dashboardJSON = `{"title":"Schema Version Test"}`
			}

			dashboardData, err := simplejson.NewJson([]byte(dashboardJSON))
			require.NoError(t, err)

			// Save the dashboard via API
			buf := &bytes.Buffer{}
			err = json.NewEncoder(buf).Encode(dashboards.SaveDashboardCommand{
				Dashboard: dashboardData,
			})
			require.NoError(t, err)

			url := fmt.Sprintf("http://admin:admin@%s/api/dashboards/db", grafanaListedAddr)
			// nolint:gosec
			resp, err := http.Post(url, "application/json", buf)
			require.NoError(t, err)
			require.Equal(t, http.StatusOK, resp.StatusCode)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})

			// Get dashboard UID from response
			b, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			var saveResp struct {
				UID string `json:"uid"`
			}
			err = json.Unmarshal(b, &saveResp)
			require.NoError(t, err)
			require.NotEmpty(t, saveResp.UID)

			getDashURL := fmt.Sprintf("http://admin:admin@%s/api/dashboards/uid/%s", grafanaListedAddr, saveResp.UID)
			// nolint:gosec
			getResp, err := http.Get(getDashURL)
			require.NoError(t, err)
			require.Equal(t, http.StatusOK, getResp.StatusCode)
			t.Cleanup(func() {
				err := getResp.Body.Close()
				require.NoError(t, err)
			})

			// Parse response and check if schema version is preserved
			dashBody, err := io.ReadAll(getResp.Body)
			require.NoError(t, err)

			var dashResp struct {
				Dashboard *simplejson.Json `json:"dashboard"`
			}
			err = json.Unmarshal(dashBody, &dashResp)
			require.NoError(t, err)

			actualSchemaVersion := dashResp.Dashboard.Get("schemaVersion")
			if schemaVersion != nil {
				// Check if schemaVersion is preserved (not migrated to latest)
				actualVersion := actualSchemaVersion.MustInt()
				require.Equal(t, *schemaVersion, actualVersion,
					"Dashboard schemaVersion should not be automatically changed when saved through /api/dashboards/db")
			} else {
				actualVersion, err := actualSchemaVersion.Int()
				s, _ := dashResp.Dashboard.EncodePretty()
				require.Error(t, err, fmt.Sprintf("Dashboard schemaVersion should not be automatically populated when saved through /api/dashboards/db, was %d. %s", actualVersion, string(s)))
			}
		})
	}
}

func TestIntegrationImportDashboardWithLibraryPanels(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})

	grafanaListedAddr, _ := testinfra.StartGrafanaEnv(t, dir, path)

	t.Run("import dashboard with library panels should create library panels and connections", func(t *testing.T) {
		dashboardJSON := `{
			"title": "Test Dashboard with Library Panels",
			"panels": [
				{
					"id": 1,
					"title": "Library Panel 1",
					"type": "text",
					"gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
					"libraryPanel": {
						"uid": "test-lib-panel-1",
						"name": "Test Library Panel 1"
					}
				},
				{
					"id": 2,
					"title": "Library Panel 2",
					"type": "stat",
					"gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
					"libraryPanel": {
						"uid": "test-lib-panel-2",
						"name": "Test Library Panel 2"
					}
				}
			],
			"__elements": {
				"test-lib-panel-1": {
					"uid": "test-lib-panel-1",
					"name": "Test Library Panel 1",
					"kind": 1,
					"type": "text",
					"model": {
						"title": "Test Library Panel 1",
						"type": "text",
						"options": {
							"content": "This is a test library panel"
						}
					}
				},
				"test-lib-panel-2": {
					"uid": "test-lib-panel-2",
					"name": "Test Library Panel 2",
					"kind": 1,
					"type": "stat",
					"model": {
						"title": "Test Library Panel 2",
						"type": "stat",
						"options": {
							"colorMode": "value",
							"graphMode": "area",
							"justifyMode": "auto",
							"orientation": "auto",
							"reduceOptions": {
								"calcs": ["lastNotNull"],
								"fields": "",
								"values": false
							},
							"textMode": "auto"
						},
						"targets": [
							{
								"refId": "A",
								"scenarioId": "csv_metric_values",
								"stringInput": "1,20,90,30,5,0"
							}
						]
					}
				}
			}
		}`

		data, err := simplejson.NewJson([]byte(dashboardJSON))
		require.NoError(t, err)

		buf := &bytes.Buffer{}
		err = json.NewEncoder(buf).Encode(dashboardimport.ImportDashboardRequest{
			Dashboard: data,
		})
		require.NoError(t, err)

		u := fmt.Sprintf("http://admin:admin@%s/api/dashboards/import", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", buf)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})

		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		var importResp struct {
			UID string `json:"uid"`
		}
		err = json.Unmarshal(b, &importResp)
		require.NoError(t, err)
		require.NotEmpty(t, importResp.UID)

		t.Run("library panels should be created", func(t *testing.T) {
			url := fmt.Sprintf("http://admin:admin@%s/api/library-elements/test-lib-panel-1", grafanaListedAddr)
			// nolint:gosec
			resp, err := http.Get(url)
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})

			panel, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			var panelRes struct {
				Result struct {
					UID  string `json:"uid"`
					Name string `json:"name"`
					Type string `json:"type"`
				} `json:"result"`
			}
			err = json.Unmarshal(panel, &panelRes)
			require.NoError(t, err)
			assert.Equal(t, "test-lib-panel-1", panelRes.Result.UID)
			assert.Equal(t, "Test Library Panel 1", panelRes.Result.Name)
			assert.Equal(t, "text", panelRes.Result.Type)

			url = fmt.Sprintf("http://admin:admin@%s/api/library-elements/test-lib-panel-2", grafanaListedAddr)
			// nolint:gosec
			resp, err = http.Get(url)
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})

			panel, err = io.ReadAll(resp.Body)
			require.NoError(t, err)
			err = json.Unmarshal(panel, &panelRes)
			require.NoError(t, err)
			assert.Equal(t, "test-lib-panel-2", panelRes.Result.UID)
			assert.Equal(t, "Test Library Panel 2", panelRes.Result.Name)
			assert.Equal(t, "stat", panelRes.Result.Type)
		})

		t.Run("library panels should be connected to dashboard", func(t *testing.T) {
			url := fmt.Sprintf("http://admin:admin@%s/api/library-elements/test-lib-panel-1/connections", grafanaListedAddr)
			// nolint:gosec
			connectionsResp, err := http.Get(url)
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, connectionsResp.StatusCode)
			t.Cleanup(func() {
				err := connectionsResp.Body.Close()
				require.NoError(t, err)
			})

			connections, err := io.ReadAll(connectionsResp.Body)
			require.NoError(t, err)
			var connectionsRes struct {
				Result []struct {
					ConnectionUID string `json:"connectionUid"`
				} `json:"result"`
			}
			err = json.Unmarshal(connections, &connectionsRes)
			require.NoError(t, err)
			assert.Len(t, connectionsRes.Result, 1)
			assert.Equal(t, importResp.UID, connectionsRes.Result[0].ConnectionUID)

			url = fmt.Sprintf("http://admin:admin@%s/api/library-elements/test-lib-panel-2/connections", grafanaListedAddr)
			// nolint:gosec
			connectionsResp, err = http.Get(url)
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, connectionsResp.StatusCode)
			t.Cleanup(func() {
				err := connectionsResp.Body.Close()
				require.NoError(t, err)
			})

			connections, err = io.ReadAll(connectionsResp.Body)
			require.NoError(t, err)
			err = json.Unmarshal(connections, &connectionsRes)
			require.NoError(t, err)
			assert.Len(t, connectionsRes.Result, 1)
			assert.Equal(t, importResp.UID, connectionsRes.Result[0].ConnectionUID)
		})
	})
}

func createDashboard(t *testing.T, grafanaListedAddr string, title string, folderID int64, folderUID string) *dashboards.Dashboard {
	t.Helper()

	buf := &bytes.Buffer{}
	err := json.NewEncoder(buf).Encode(map[string]interface{}{
		"dashboard": map[string]interface{}{
			"title": title,
		},
		"folderId":  folderID,
		"folderUid": folderUID,
		"overwrite": true,
	})
	require.NoError(t, err)

	u := fmt.Sprintf("http://admin:admin@%s/api/dashboards/db", grafanaListedAddr)
	// nolint:gosec
	resp, err := http.Post(u, "application/json", buf)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	t.Cleanup(func() {
		err := resp.Body.Close()
		require.NoError(t, err)
	})

	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	var saveResp struct {
		Status    string `json:"status"`
		Slug      string `json:"slug"`
		Version   int64  `json:"version"`
		ID        int64  `json:"id"`
		UID       string `json:"uid"`
		URL       string `json:"url"`
		FolderUID string `json:"folderUid"`
	}
	err = json.Unmarshal(b, &saveResp)
	require.NoError(t, err)
	require.NotEmpty(t, saveResp.UID)

	return &dashboards.Dashboard{
		ID:        saveResp.ID, // nolint:staticcheck
		UID:       saveResp.UID,
		Slug:      saveResp.Slug,
		Version:   int(saveResp.Version),
		FolderUID: saveResp.FolderUID,
	}
}

func postDashboard(t *testing.T, grafanaListedAddr, user, password string, payload map[string]interface{}) (*http.Response, error) {
	t.Helper()

	payloadBytes, err := json.Marshal(payload)
	require.NoError(t, err)

	u := fmt.Sprintf("http://%s:%s@%s/api/dashboards/db", user, password, grafanaListedAddr)
	return http.Post(u, "application/json", bytes.NewBuffer(payloadBytes)) // nolint:gosec
}

func TestIntegrationDashboardServicePermissions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})
	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	tests.CreateUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Login:          "editor",
		Password:       "editor",
		IsAdmin:        false,
	}, grafanaListedAddr)
	tests.CreateUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleViewer),
		Login:          "viewer",
		Password:       "viewer",
		IsAdmin:        false,
	}, grafanaListedAddr)
	savedFolder := createFolder(t, grafanaListedAddr, "Saved folder")
	otherSavedFolder := createFolder(t, grafanaListedAddr, "Other saved folder")
	savedDashInFolder := createDashboard(t, grafanaListedAddr, "Saved dash in folder", savedFolder.ID, savedFolder.UID) // nolint:staticcheck
	savedDashInGeneralFolder := createDashboard(t, grafanaListedAddr, "Saved dashboard in general folder", 0, "")

	t.Run("When creating a new dashboard in the General folder, requires create permissions scoped to the general folder", func(t *testing.T) {
		dashboardPayload := map[string]interface{}{
			"dashboard": map[string]interface{}{
				"title": "Dash",
			},
			"overwrite": true,
		}

		payloadBytes, err := json.Marshal(dashboardPayload)
		require.NoError(t, err)

		u := fmt.Sprintf("http://viewer:viewer@%s/api/dashboards/db", grafanaListedAddr)
		resp, err := http.Post(u, "application/json", bytes.NewBuffer(payloadBytes)) // nolint:gosec
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)

		u = fmt.Sprintf("http://editor:editor@%s/api/dashboards/db", grafanaListedAddr)
		resp, err = http.Post(u, "application/json", bytes.NewBuffer(payloadBytes)) // nolint:gosec
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)
	})

	t.Run("When creating a new dashboard in other folder, requires create permissions scoped to the other folder", func(t *testing.T) {
		dashboardPayload := map[string]interface{}{
			"dashboard": map[string]interface{}{
				"title": "Dash",
			},
			"folderUid": otherSavedFolder.UID,
			"overwrite": true,
		}

		resp, err := postDashboard(t, grafanaListedAddr, "viewer", "viewer", dashboardPayload)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)

		resp, err = postDashboard(t, grafanaListedAddr, "editor", "editor", dashboardPayload)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)
	})

	t.Run("When creating a new dashboard by existing UID in folder, requires write permissions on the existing dashboard", func(t *testing.T) {
		dashboardPayload := map[string]interface{}{
			"dashboard": map[string]interface{}{
				"uid":   savedDashInFolder.UID,
				"title": "New dash",
			},
			"folderUid": savedFolder.UID,
			"overwrite": true,
		}

		resp, err := postDashboard(t, grafanaListedAddr, "viewer", "viewer", dashboardPayload)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)

		resp, err = postDashboard(t, grafanaListedAddr, "editor", "editor", dashboardPayload)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)
	})

	t.Run("When moving a dashboard by existing uid to other folder from General folder, requires dashboard creation permissions on the destination folder and write access to the dashboard", func(t *testing.T) {
		dashboardPayload := map[string]interface{}{
			"dashboard": map[string]interface{}{
				"uid":   savedDashInGeneralFolder.UID,
				"title": "Dash",
			},
			"folderUid": otherSavedFolder.UID,
			"overwrite": true,
		}

		resp, err := postDashboard(t, grafanaListedAddr, "viewer", "viewer", dashboardPayload)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)

		resp, err = postDashboard(t, grafanaListedAddr, "editor", "editor", dashboardPayload)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)
	})

	t.Run("When moving a dashboard by existing uid to the General folder from other folder, requires dashboard creation permissions on the general folder and write access to the dashboard", func(t *testing.T) {
		dashboardPayload := map[string]interface{}{
			"dashboard": map[string]interface{}{
				"uid":   savedDashInFolder.UID,
				"title": "Dash",
			},
			"folderUid": "",
			"overwrite": true,
		}

		resp, err := postDashboard(t, grafanaListedAddr, "viewer", "viewer", dashboardPayload)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)

		resp, err = postDashboard(t, grafanaListedAddr, "editor", "editor", dashboardPayload)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		err = resp.Body.Close()
		require.NoError(t, err)
	})

	t.Run("RBAC tests", func(t *testing.T) {
		setFolderPermissions := func(t *testing.T, grafanaListedAddr string, folderUID string, permissions []map[string]interface{}) {
			t.Helper()

			permissionPayload := map[string]interface{}{
				"items": permissions,
			}

			payloadBytes, err := json.Marshal(permissionPayload)
			require.NoError(t, err)

			u := fmt.Sprintf("http://admin:admin@%s/api/folders/%s/permissions", grafanaListedAddr, folderUID)
			resp, err := http.Post(u, "application/json", bytes.NewBuffer(payloadBytes)) // nolint:gosec
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
			err = resp.Body.Close()
			require.NoError(t, err)
		}

		searchDashboards := func(t *testing.T, grafanaListedAddr string, userLogin, userPassword string) []map[string]interface{} {
			t.Helper()

			u := fmt.Sprintf("http://%s:%s@%s/api/search?type=dash-db", userLogin, userPassword, grafanaListedAddr)
			resp, err := http.Get(u) // nolint:gosec
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
			defer resp.Body.Close() // nolint:errcheck

			var results []map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&results)
			require.NoError(t, err)

			return results
		}

		noneUserID := tests.CreateUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleNone),
			Login:          "noneuser",
			Password:       "noneuser",
			IsAdmin:        false,
		}, grafanaListedAddr)
		parentFolder := createFolder(t, grafanaListedAddr, "parent")
		childFolder := createFolder(t, grafanaListedAddr, "child")
		createDashboard(t, grafanaListedAddr, "dashboard in root", 0, "")
		createDashboard(t, grafanaListedAddr, "dashboard in parent", parentFolder.ID, parentFolder.UID) // nolint:staticcheck
		createDashboard(t, grafanaListedAddr, "dashboard in child", childFolder.ID, childFolder.UID)    // nolint:staticcheck

		viewPermissions := []map[string]interface{}{
			{
				"permission": 1,
				"userId":     noneUserID,
			},
		}
		t.Run("it should not return folder if ACL is not set for parent folder", func(t *testing.T) {
			results := searchDashboards(t, grafanaListedAddr, "noneuser", "noneuser")
			assert.Empty(t, results, "Should not return any dashboards when no permissions are set")
		})

		t.Run("it should return child folder when user has permission to read child folder", func(t *testing.T) {
			setFolderPermissions(t, grafanaListedAddr, childFolder.UID, viewPermissions)
			results := searchDashboards(t, grafanaListedAddr, "noneuser", "noneuser")

			foundTitles := make([]string, 0)
			for _, result := range results {
				if title, ok := result["title"].(string); ok {
					foundTitles = append(foundTitles, title)
				}
			}

			assert.Contains(t, foundTitles, "dashboard in child", "Should return dashboard in child folder")
		})

		t.Run("it should return parent folder when user has permission to read parent folder but no permission to read child folder", func(t *testing.T) {
			setFolderPermissions(t, grafanaListedAddr, parentFolder.UID, viewPermissions)
			setFolderPermissions(t, grafanaListedAddr, childFolder.UID, []map[string]interface{}{})

			results := searchDashboards(t, grafanaListedAddr, "noneuser", "noneuser")

			foundTitles := make([]string, 0)
			for _, result := range results {
				if title, ok := result["title"].(string); ok {
					foundTitles = append(foundTitles, title)
				}
			}

			assert.Contains(t, foundTitles, "dashboard in parent", "Should return dashboard in parent folder")
			assert.NotContains(t, foundTitles, "dashboard in child", "Should not return dashboard in child folder")
		})
	})
}
