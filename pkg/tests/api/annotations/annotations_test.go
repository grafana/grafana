package annotations

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"

	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationAnnotations(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous:     true,
		EnableFeatureToggles: []string{featuremgmt.FlagAnnotationPermissionUpdate},
	})
	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	noneUserID := tests.CreateUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleNone),
		Login:          "noneuser",
		Password:       "noneuser",
		IsAdmin:        false,
		OrgID:          1,
	})

	tests.CreateUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Login:          "editor",
		Password:       "editor",
		IsAdmin:        false,
		OrgID:          1,
	})

	tests.CreateUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleViewer),
		Login:          "viewer",
		Password:       "viewer",
		IsAdmin:        false,
		OrgID:          1,
	})
	savedFolder := createFolder(t, grafanaListedAddr, "Test Folder")
	dash1 := createDashboard(t, grafanaListedAddr, "Dashboard 1", savedFolder.ID, savedFolder.UID) // nolint:staticcheck
	dash2 := createDashboard(t, grafanaListedAddr, "Dashboard 2", savedFolder.ID, savedFolder.UID) // nolint:staticcheck
	createAnnotation(t, grafanaListedAddr, "admin", "admin", map[string]interface{}{
		"dashboardId": dash1.ID,
		"panelId":     1,
		"text":        "Dashboard 1 annotation",
		"time":        1234567890000,
	})

	createAnnotation(t, grafanaListedAddr, "admin", "admin", map[string]interface{}{
		"dashboardId": dash2.ID,
		"panelId":     1,
		"text":        "Dashboard 2 annotation",
		"time":        1234567890000,
	})

	createAnnotation(t, grafanaListedAddr, "admin", "admin", map[string]interface{}{
		"text": "Organization annotation",
		"time": 1234567890000,
	})

	t.Run("basic tests", func(t *testing.T) {
		t.Run("should allow accessing annotations for specific dashboard", func(t *testing.T) {
			url := fmt.Sprintf("http://admin:admin@%s/api/annotations?dashboardId=%d", grafanaListedAddr, dash1.ID)
			resp, err := http.Get(url) // nolint:gosec
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)

			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			err = resp.Body.Close()
			require.NoError(t, err)

			var annotations []interface{}
			err = json.Unmarshal(body, &annotations)
			require.NoError(t, err)
			assert.Len(t, annotations, 1)
		})

		t.Run("should allow accessing annotations for specific dashboard by UID", func(t *testing.T) {
			url := fmt.Sprintf("http://admin:admin@%s/api/annotations?dashboardUID=%s", grafanaListedAddr, dash1.UID)
			resp, err := http.Get(url) // nolint:gosec
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)

			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			err = resp.Body.Close()
			require.NoError(t, err)

			var annotations []interface{}
			err = json.Unmarshal(body, &annotations)
			require.NoError(t, err)
			assert.Len(t, annotations, 1)
		})
	})

	t.Run("access control tests", func(t *testing.T) {
		viewPermissions := []map[string]interface{}{
			{
				"permission": 1,
				"userId":     noneUserID,
			},
		}

		t.Run("should have no dashboards if missing annotation read permission on dashboards", func(t *testing.T) {
			url := fmt.Sprintf("http://noneuser:noneuser@%s/api/annotations", grafanaListedAddr)
			resp, err := http.Get(url) // nolint:gosec
			require.NoError(t, err)
			assert.Equal(t, resp.StatusCode, http.StatusForbidden)
			err = resp.Body.Close()
			require.NoError(t, err)
		})

		t.Run("should be able to see annotations for dashboards that user has access to", func(t *testing.T) {
			setDashboardPermissions(t, grafanaListedAddr, dash1.UID, viewPermissions)

			// should be able to get first one
			url := fmt.Sprintf("http://noneuser:noneuser@%s/api/annotations?dashboardId=%d", grafanaListedAddr, dash1.ID)
			resp, err := http.Get(url) // nolint:gosec
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
			err = resp.Body.Close()
			require.NoError(t, err)

			// cannot get the second one
			url = fmt.Sprintf("http://noneuser:noneuser@%s/api/annotations?dashboardId=%d", grafanaListedAddr, dash2.ID)
			resp, err = http.Get(url) // nolint:gosec
			require.NoError(t, err)
			assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
			err = resp.Body.Close()
			require.NoError(t, err)
		})

		t.Run("should inherit folder permissions", func(t *testing.T) {
			setFolderPermissions(t, grafanaListedAddr, savedFolder.UID, viewPermissions)

			url := fmt.Sprintf("http://noneuser:noneuser@%s/api/annotations", grafanaListedAddr)
			resp, err := http.Get(url) // nolint:gosec
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)

			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			err = resp.Body.Close()
			require.NoError(t, err)

			var annotations []interface{}
			err = json.Unmarshal(body, &annotations)
			require.NoError(t, err)
			assert.Len(t, annotations, 2)
		})

		t.Run("should allow admin to access all annotations", func(t *testing.T) {
			url := fmt.Sprintf("http://admin:admin@%s/api/annotations", grafanaListedAddr)
			resp, err := http.Get(url) // nolint:gosec
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			err = resp.Body.Close()
			require.NoError(t, err)

			var annotations []interface{}
			err = json.Unmarshal(body, &annotations)
			require.NoError(t, err)
			assert.Len(t, annotations, 3)
		})

		dash3 := createDashboard(t, grafanaListedAddr, "Dashboard 3", 0, "")
		createAnnotation(t, grafanaListedAddr, "admin", "admin", map[string]interface{}{
			"dashboardId": dash3.ID,
			"panelId":     1,
			"text":        "Dashboard 3 annotation",
			"time":        1234567890000,
		})

		t.Run("should allow editor to access org annotations and annotations for dashboards they have access to (dash3)", func(t *testing.T) {
			url := fmt.Sprintf("http://editor:editor@%s/api/annotations", grafanaListedAddr)
			resp, err := http.Get(url) // nolint:gosec
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			err = resp.Body.Close()
			require.NoError(t, err)

			var annotations []interface{}
			err = json.Unmarshal(body, &annotations)
			require.NoError(t, err)
			assert.Len(t, annotations, 2)
		})

		t.Run("should allow viewer to access org annotations and annotations for dashboards they have access to (dash3)", func(t *testing.T) {
			url := fmt.Sprintf("http://viewer:viewer@%s/api/annotations", grafanaListedAddr)
			resp, err := http.Get(url) // nolint:gosec
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			err = resp.Body.Close()
			require.NoError(t, err)

			var annotations []interface{}
			err = json.Unmarshal(body, &annotations)
			require.NoError(t, err)
			assert.Len(t, annotations, 2)
		})

		t.Run("should allow editor to create org annotations", func(t *testing.T) {
			annotationPayload := map[string]interface{}{
				"text": "Test annotations",
				"time": 1234567890000,
			}

			payloadBytes, err := json.Marshal(annotationPayload)
			require.NoError(t, err)
			url := fmt.Sprintf("http://editor:editor@%s/api/annotations", grafanaListedAddr)
			resp, err := http.Post(url, "application/json", bytes.NewBuffer(payloadBytes)) // nolint:gosec
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
			err = resp.Body.Close()
			require.NoError(t, err)
		})

		t.Run("should deny viewer from creating org annotations", func(t *testing.T) {
			annotationPayload := map[string]interface{}{
				"text": "Test annotation",
				"time": 1234567890000,
			}

			payloadBytes, err := json.Marshal(annotationPayload)
			require.NoError(t, err)

			url := fmt.Sprintf("http://viewer:viewer@%s/api/annotations", grafanaListedAddr)
			resp, err := http.Post(url, "application/json", bytes.NewBuffer(payloadBytes)) // nolint:gosec
			require.NoError(t, err)
			assert.Equal(t, http.StatusForbidden, resp.StatusCode)
			err = resp.Body.Close()
			require.NoError(t, err)
		})

		t.Run("should allow editor to create dashboard annotations", func(t *testing.T) {
			annotationPayload := map[string]interface{}{
				"dashboardId": dash3.ID,
				"panelId":     1,
				"text":        "Test annotations",
				"time":        1234567890000,
			}

			payloadBytes, err := json.Marshal(annotationPayload)
			require.NoError(t, err)
			url := fmt.Sprintf("http://editor:editor@%s/api/annotations", grafanaListedAddr)
			resp, err := http.Post(url, "application/json", bytes.NewBuffer(payloadBytes)) // nolint:gosec
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
			err = resp.Body.Close()
			require.NoError(t, err)
		})

		t.Run("should deny viewer from creating dashboard annotations", func(t *testing.T) {
			annotationPayload := map[string]interface{}{
				"dashboardId": dash3.ID,
				"panelId":     1,
				"text":        "Test annotation",
				"time":        1234567890000,
			}

			payloadBytes, err := json.Marshal(annotationPayload)
			require.NoError(t, err)

			url := fmt.Sprintf("http://viewer:viewer@%s/api/annotations", grafanaListedAddr)
			resp, err := http.Post(url, "application/json", bytes.NewBuffer(payloadBytes)) // nolint:gosec
			require.NoError(t, err)
			assert.Equal(t, http.StatusForbidden, resp.StatusCode)
			err = resp.Body.Close()
			require.NoError(t, err)
		})
	})
}

func createAnnotation(t *testing.T, grafanaListedAddr string, username, password string, payload map[string]interface{}) {
	t.Helper()

	payloadBytes, err := json.Marshal(payload)
	require.NoError(t, err)

	url := fmt.Sprintf("http://%s:%s@%s/api/annotations", username, password, grafanaListedAddr)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(payloadBytes)) // nolint:gosec
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	err = resp.Body.Close()
	require.NoError(t, err)
}

func setDashboardPermissions(t *testing.T, grafanaListedAddr string, dashboardUID string, permissions []map[string]interface{}) {
	t.Helper()

	payload := map[string]interface{}{
		"items": permissions,
	}

	payloadBytes, err := json.Marshal(payload)
	require.NoError(t, err)

	url := fmt.Sprintf("http://admin:admin@%s/api/dashboards/uid/%s/permissions", grafanaListedAddr, dashboardUID)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(payloadBytes))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	err = resp.Body.Close()
	require.NoError(t, err)
}

func setFolderPermissions(t *testing.T, grafanaListedAddr string, folderUID string, permissions []map[string]interface{}) {
	t.Helper()

	payload := map[string]interface{}{
		"items": permissions,
	}

	payloadBytes, err := json.Marshal(payload)
	require.NoError(t, err)

	url := fmt.Sprintf("http://admin:admin@%s/api/folders/%s/permissions", grafanaListedAddr, folderUID)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(payloadBytes))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	err = resp.Body.Close()
	require.NoError(t, err)
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
