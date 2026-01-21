package datasources

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// testMode groups feature toggles needed for different test scenarios
type testMode struct {
	name           string
	featureToggles []string
}

// getTestModes returns the test configurations to run tests against
func getTestModes() []testMode {
	return []testMode{
		{name: "legacy", featureToggles: nil},
		{name: "k8s-reroute", featureToggles: []string{
			"datasourcesRerouteLegacyCRUDAPIs",
			"queryService",                // need query.grafana.app API group
			"queryServiceWithConnections", // need query.grafana.app connections subresource
		}},
	}
}

// TestIntegrationDataSourceGetByUID tests the GET /api/datasources/uid/:uid endpoint
// with both legacy and K8s-reroute feature flag modes.
func TestIntegrationDataSourceGetByUID(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, mode := range getTestModes() {
		t.Run(mode.name, func(t *testing.T) {
			// set up Grafana and a database
			dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
				DisableAnonymous:     true,
				EnableFeatureToggles: mode.featureToggles,
			})
			grafanaListeningAddr, testEnv := testinfra.StartGrafanaEnv(t, dir, path)
			ctx := context.Background()
			store := testEnv.SQLStore
			cfg := testEnv.Cfg

			runGetTests(t, ctx, grafanaListeningAddr, testEnv, store, cfg, mode.name)
		})
	}
}

// runGetTests runs all GET endpoint tests
//
// TODO: add tests that exercise the access-control optional response.
func runGetTests(t *testing.T, ctx context.Context, grafanaListeningAddr string, testEnv *server.TestEnv, store db.DB, cfg *setting.Cfg, modePrefix string) {
	t.Run("GET - succeeds", func(t *testing.T) {
		// make a unique-enough UID - all the tests in this file share the same grafana instance.
		uid := fmt.Sprintf("%s-prometheus-get", modePrefix)
		jsonData := simplejson.NewFromAny(map[string]any{
			"httpMethod": "POST",
		})

		// populate as many fields as possible so we can check them for equality in the response.
		_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx,
			&datasources.AddDataSourceCommand{
				OrgID:         1,
				Access:        datasources.DS_ACCESS_PROXY,
				Name:          "Test Prometheus",
				Type:          datasources.DS_PROMETHEUS,
				UID:           uid,
				URL:           "http://localhost:9090",
				User:          "testuser",
				Database:      "testdb",
				BasicAuth:     true,
				BasicAuthUser: "basicuser",
				JsonData:      jsonData,
				SecureJsonData: map[string]string{
					"basicAuthPassword": "secret",
				},
			})
		require.NoError(t, err)

		url := fmt.Sprintf("http://admin:admin@%s/api/datasources/uid/%s", grafanaListeningAddr, uid)
		resp, err := http.Get(url)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusOK, resp.StatusCode)

		var dto dtos.DataSource
		err = json.NewDecoder(resp.Body).Decode(&dto)
		require.NoError(t, err)

		require.Equal(t, uid, dto.UID)
		require.Equal(t, "Test Prometheus", dto.Name)
		require.Equal(t, "prometheus", dto.Type)
		require.Equal(t, datasources.DsAccess(datasources.DS_ACCESS_PROXY), dto.Access)
		require.Equal(t, "http://localhost:9090", dto.Url)
		require.Equal(t, "testuser", dto.User)
		require.Equal(t, "testdb", dto.Database)
		require.True(t, dto.BasicAuth)
		require.Equal(t, "basicuser", dto.BasicAuthUser)
		require.NotNil(t, dto.JsonData)
		require.True(t, dto.SecureJsonFields["basicAuthPassword"])
		require.Greater(t, dto.Id, int64(0))
		require.Equal(t, int64(1), dto.OrgId)
	})

	t.Run("GET - not found", func(t *testing.T) {
		url := fmt.Sprintf("http://admin:admin@%s/api/datasources/uid/%s-nonexistent-get", grafanaListeningAddr, modePrefix)
		resp, err := http.Get(url)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	// TODO: support resource-scoped tests against the k8s-reroute path (currently they give 403)
	if modePrefix == "legacy" {
		t.Run("GET - specific UID scope granted", func(t *testing.T) {
			dsUID := fmt.Sprintf("%s-ds-get-perms-0", modePrefix)
			createTestDataSource(t, ctx, testEnv.Server.HTTPServer.DataSourcesService, dsUID, "Test DS for GET Permissions 0")

			login := fmt.Sprintf("%s-user-get-0", modePrefix)
			createUserWithPermissions(t, ctx, store, cfg, grafanaListeningAddr, login, []resourcepermissions.SetResourcePermissionCommand{
				{
					Actions:           []string{datasources.ActionRead},
					Resource:          "datasources",
					ResourceAttribute: "uid",
					ResourceID:        dsUID,
				},
			})

			url := fmt.Sprintf("http://%s:testpass@%s/api/datasources/uid/%s", login, grafanaListeningAddr, dsUID)
			resp, err := http.Get(url)
			require.NoError(t, err)
			defer resp.Body.Close()

			require.Equal(t, http.StatusOK, resp.StatusCode)
		})
	}

	// TODO: support wildcard resource-scoped tests against the k8s-reroute path (currently they give 403)
	if modePrefix == "legacy" {
		t.Run("GET - wildcard UID scope granted", func(t *testing.T) {
			dsUID := fmt.Sprintf("%s-ds-get-perms-1", modePrefix)
			_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx,
				&datasources.AddDataSourceCommand{
					OrgID:  1,
					Access: datasources.DS_ACCESS_PROXY,
					Name:   "Test DS for GET Permissions 1",
					Type:   datasources.DS_PROMETHEUS,
					UID:    dsUID,
					URL:    "http://localhost:9090",
				})
			require.NoError(t, err)

			login := fmt.Sprintf("%s-user-get-1", modePrefix)
			password := "testpass"
			createUserWithPermissions(t, ctx, store, cfg, grafanaListeningAddr, login, []resourcepermissions.SetResourcePermissionCommand{
				{
					Actions:           []string{datasources.ActionRead},
					Resource:          "datasources",
					ResourceAttribute: "uid",
					ResourceID:        "*",
				},
			})

			url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s",
				login, password, grafanaListeningAddr, dsUID)
			resp, err := http.Get(url)
			require.NoError(t, err)
			defer resp.Body.Close()

			require.Equal(t, http.StatusOK, resp.StatusCode)
		})
	}

	t.Run("GET - permission denied (wrong UID scope)", func(t *testing.T) {
		dsUID := fmt.Sprintf("%s-ds-get-perms-2", modePrefix)
		_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx,
			&datasources.AddDataSourceCommand{
				OrgID:  1,
				Access: datasources.DS_ACCESS_PROXY,
				Name:   "Test DS for GET Permissions 2",
				Type:   datasources.DS_PROMETHEUS,
				UID:    dsUID,
				URL:    "http://localhost:9090",
			})
		require.NoError(t, err)

		login := fmt.Sprintf("%s-user-get-2", modePrefix)
		password := "testpass"
		createUserWithPermissions(t, ctx, store, cfg, grafanaListeningAddr, login, []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{datasources.ActionRead},
				Resource:          "datasources",
				ResourceAttribute: "uid",
				ResourceID:        "other-uid",
			},
		})

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s",
			login, password, grafanaListeningAddr, dsUID)
		resp, err := http.Get(url)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("GET - permission denied (no permissions)", func(t *testing.T) {
		dsUID := fmt.Sprintf("%s-ds-get-perms-3", modePrefix)
		_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx,
			&datasources.AddDataSourceCommand{
				OrgID:  1,
				Access: datasources.DS_ACCESS_PROXY,
				Name:   "Test DS for GET Permissions 3",
				Type:   datasources.DS_PROMETHEUS,
				UID:    dsUID,
				URL:    "http://localhost:9090",
			})
		require.NoError(t, err)

		login := fmt.Sprintf("%s-user-get-3", modePrefix)
		password := "testpass"

		// create user with no resource permissions
		createUserWithPermissions(t, ctx, store, cfg, grafanaListeningAddr, login, []resourcepermissions.SetResourcePermissionCommand{})

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s",
			login, password, grafanaListeningAddr, dsUID)
		resp, err := http.Get(url)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	// Role-based access GET tests
	t.Run("GET - Admin role succeeds", func(t *testing.T) {
		dsUID := fmt.Sprintf("%s-ds-role-admin-get", modePrefix)
		createTestDataSource(t, ctx, testEnv.Server.HTTPServer.DataSourcesService, dsUID, "Test DS for Admin GET")

		url := fmt.Sprintf("http://admin:admin@%s/api/datasources/uid/%s", grafanaListeningAddr, dsUID)
		resp, err := http.Get(url)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("GET - Editor role succeeds", func(t *testing.T) {
		dsUID := fmt.Sprintf("%s-ds-role-editor-get", modePrefix)
		createTestDataSource(t, ctx, testEnv.Server.HTTPServer.DataSourcesService, dsUID, "Test DS for Editor GET")

		login := fmt.Sprintf("%s-editor-user-get", modePrefix)
		password := "testpass"
		_ = tests.CreateUser(t, store, cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleEditor),
			Password:       user.Password(password),
			Login:          login,
			OrgID:          1,
		})

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s", login, password, grafanaListeningAddr, dsUID)
		resp, err := http.Get(url)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("GET - Viewer role succeeds", func(t *testing.T) {
		dsUID := fmt.Sprintf("%s-ds-role-viewer-get", modePrefix)
		createTestDataSource(t, ctx, testEnv.Server.HTTPServer.DataSourcesService, dsUID, "Test DS for Viewer GET")

		login := fmt.Sprintf("%s-viewer-user-get", modePrefix)
		password := "testpass"
		_ = tests.CreateUser(t, store, cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleViewer),
			Password:       user.Password(password),
			Login:          login,
			OrgID:          1,
		})

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s", login, password, grafanaListeningAddr, dsUID)
		resp, err := http.Get(url)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

// TestIntegrationDataSourcePutByUID tests the PUT /api/datasources/uid/:uid endpoint.
//
// k8s-reroute PUT handler is not implemented yet! This only tests the legacy mode.
func TestIntegrationDataSourcePutByUID(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})
	grafanaListeningAddr, testEnv := testinfra.StartGrafanaEnv(t, dir, path)
	ctx := context.Background()
	store := testEnv.SQLStore
	cfg := testEnv.Cfg

	t.Run("PUT - succeeds", func(t *testing.T) {
		uid := "test-update-ds"
		_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx,
			&datasources.AddDataSourceCommand{
				OrgID:  1,
				Access: datasources.DS_ACCESS_PROXY,
				Name:   "Original Name",
				Type:   datasources.DS_PROMETHEUS,
				UID:    uid,
				URL:    "http://localhost:9090",
			})
		require.NoError(t, err)

		updatePayload := map[string]any{
			"name":   "Updated Name",
			"type":   "prometheus",
			"url":    "http://localhost:9091",
			"access": "proxy",
		}
		body, _ := json.Marshal(updatePayload)

		url := fmt.Sprintf("http://admin:admin@%s/api/datasources/uid/%s", grafanaListeningAddr, uid)
		req, _ := http.NewRequest(http.MethodPut, url, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusOK, resp.StatusCode)

		var result map[string]any
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		fmt.Printf("result: %+v\n", result["datasource"])

		// Check the updated datasource looks as expected.
		// the PUT response embeds the updated datasource in the "datasource" property, so extract it.
		var dto dtos.DataSource
		b, err := json.Marshal(result["datasource"])
		require.NoError(t, err)
		err = json.Unmarshal(b, &dto)
		require.NoError(t, err)
		require.Equal(t, "Updated Name", dto.Name)
		require.Equal(t, "http://localhost:9091", dto.Url)
		require.Equal(t, datasources.DsAccess(datasources.DS_ACCESS_PROXY), dto.Access)
		require.Equal(t, "prometheus", dto.Type)
		require.NotNil(t, dto.JsonData)
		require.Equal(t, int64(1), dto.OrgId)
	})

	t.Run("PUT - not found", func(t *testing.T) {
		updatePayload := map[string]any{
			"name":   "Updated Name",
			"type":   "prometheus",
			"url":    "http://localhost:9091",
			"access": "proxy",
		}
		body, _ := json.Marshal(updatePayload)

		url := fmt.Sprintf("http://admin:admin@%s/api/datasources/uid/nonexistent-put", grafanaListeningAddr)
		req, _ := http.NewRequest(http.MethodPut, url, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("PUT - specific UID scope granted", func(t *testing.T) {
		dsUID := "test-ds-update-perms-0"
		_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx,
			&datasources.AddDataSourceCommand{
				OrgID:  1,
				Access: datasources.DS_ACCESS_PROXY,
				Name:   "Test DS for Update Permissions 0",
				Type:   datasources.DS_PROMETHEUS,
				UID:    dsUID,
				URL:    "http://localhost:9090",
			})
		require.NoError(t, err)

		login := "user-put-0"
		password := "testpass"
		createUserWithPermissions(t, ctx, store, cfg, grafanaListeningAddr, login, []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{datasources.ActionWrite},
				Resource:          "datasources",
				ResourceAttribute: "uid",
				ResourceID:        dsUID,
			},
		})

		updatePayload := map[string]any{
			"name":   "Updated Name 0",
			"type":   "prometheus",
			"url":    "http://localhost:9091",
			"access": "proxy",
		}
		body, _ := json.Marshal(updatePayload)

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s",
			login, password, grafanaListeningAddr, dsUID)
		req, _ := http.NewRequest(http.MethodPut, url, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("PUT - wildcard scope granted", func(t *testing.T) {
		dsUID := "test-ds-update-perms-1"
		_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx,
			&datasources.AddDataSourceCommand{
				OrgID:  1,
				Access: datasources.DS_ACCESS_PROXY,
				Name:   "Test DS for Update Permissions 1",
				Type:   datasources.DS_PROMETHEUS,
				UID:    dsUID,
				URL:    "http://localhost:9090",
			})
		require.NoError(t, err)

		login := "user-put-1"
		password := "testpass"
		createUserWithPermissions(t, ctx, store, cfg, grafanaListeningAddr, login, []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{datasources.ActionWrite},
				Resource:          "datasources",
				ResourceAttribute: "uid",
				ResourceID:        "*",
			},
		})

		updatePayload := map[string]any{
			"name":   "Updated Name 1",
			"type":   "prometheus",
			"url":    "http://localhost:9091",
			"access": "proxy",
		}
		body, _ := json.Marshal(updatePayload)

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s",
			login, password, grafanaListeningAddr, dsUID)
		req, _ := http.NewRequest(http.MethodPut, url, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("PUT - permission denied (wrong UID scope)", func(t *testing.T) {
		dsUID := "test-ds-update-perms-2"
		_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx,
			&datasources.AddDataSourceCommand{
				OrgID:  1,
				Access: datasources.DS_ACCESS_PROXY,
				Name:   "Test DS for Update Permissions 2",
				Type:   datasources.DS_PROMETHEUS,
				UID:    dsUID,
				URL:    "http://localhost:9090",
			})
		require.NoError(t, err)

		login := "user-put-2"
		password := "testpass"
		createUserWithPermissions(t, ctx, store, cfg, grafanaListeningAddr, login, []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{datasources.ActionWrite},
				Resource:          "datasources",
				ResourceAttribute: "uid",
				ResourceID:        "other-uid",
			},
		})

		updatePayload := map[string]any{
			"name":   "Updated Name 2",
			"type":   "prometheus",
			"url":    "http://localhost:9091",
			"access": "proxy",
		}
		body, _ := json.Marshal(updatePayload)

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s",
			login, password, grafanaListeningAddr, dsUID)
		req, _ := http.NewRequest(http.MethodPut, url, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("PUT - permission denied (read only)", func(t *testing.T) {
		dsUID := "test-ds-update-perms-3"
		_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx,
			&datasources.AddDataSourceCommand{
				OrgID:  1,
				Access: datasources.DS_ACCESS_PROXY,
				Name:   "Test DS for Update Permissions 3",
				Type:   datasources.DS_PROMETHEUS,
				UID:    dsUID,
				URL:    "http://localhost:9090",
			})
		require.NoError(t, err)

		login := "user-put-3"
		password := "testpass"
		createUserWithPermissions(t, ctx, store, cfg, grafanaListeningAddr, login, []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{datasources.ActionRead},
				Resource:          "datasources",
				ResourceAttribute: "uid",
				ResourceID:        dsUID,
			},
		})

		updatePayload := map[string]any{
			"name":   "Updated Name 3",
			"type":   "prometheus",
			"url":    "http://localhost:9091",
			"access": "proxy",
		}
		body, _ := json.Marshal(updatePayload)

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s",
			login, password, grafanaListeningAddr, dsUID)
		req, _ := http.NewRequest(http.MethodPut, url, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("PUT - permission denied (no permissions)", func(t *testing.T) {
		dsUID := "test-ds-update-perms-4"
		_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx,
			&datasources.AddDataSourceCommand{
				OrgID:  1,
				Access: datasources.DS_ACCESS_PROXY,
				Name:   "Test DS for Update Permissions 4",
				Type:   datasources.DS_PROMETHEUS,
				UID:    dsUID,
				URL:    "http://localhost:9090",
			})
		require.NoError(t, err)

		login := "user-put-4"
		password := "testpass"
		createUserWithPermissions(t, ctx, store, cfg, grafanaListeningAddr, login, []resourcepermissions.SetResourcePermissionCommand{})

		updatePayload := map[string]any{
			"name":   "Updated Name 4",
			"type":   "prometheus",
			"url":    "http://localhost:9091",
			"access": "proxy",
		}
		body, _ := json.Marshal(updatePayload)

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s",
			login, password, grafanaListeningAddr, dsUID)
		req, _ := http.NewRequest(http.MethodPut, url, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	// Role-based PUT tests
	t.Run("PUT - Admin role succeeds", func(t *testing.T) {
		dsUID := "test-ds-role-admin-put"
		createTestDataSource(t, ctx, testEnv.Server.HTTPServer.DataSourcesService, dsUID, "Test DS for Admin PUT")

		login := "admin-user-put"
		password := "testpass"
		_ = tests.CreateUser(t, store, cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleAdmin),
			Password:       user.Password(password),
			Login:          login,
			OrgID:          1,
		})

		updatePayload := map[string]any{
			"name":   "Updated by Admin",
			"type":   "prometheus",
			"url":    "http://localhost:9091",
			"access": "proxy",
		}
		body, _ := json.Marshal(updatePayload)

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s", login, password, grafanaListeningAddr, dsUID)
		req, _ := http.NewRequest(http.MethodPut, url, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("PUT - Editor role denied", func(t *testing.T) {
		dsUID := "test-ds-role-editor-put"
		createTestDataSource(t, ctx, testEnv.Server.HTTPServer.DataSourcesService, dsUID, "Test DS for Editor PUT")

		login := "editor-user-put"
		password := "testpass"
		_ = tests.CreateUser(t, store, cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleEditor),
			Password:       user.Password(password),
			Login:          login,
			OrgID:          1,
		})

		updatePayload := map[string]any{
			"name":   "Updated by Editor",
			"type":   "prometheus",
			"url":    "http://localhost:9091",
			"access": "proxy",
		}
		body, _ := json.Marshal(updatePayload)

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s", login, password, grafanaListeningAddr, dsUID)
		req, _ := http.NewRequest(http.MethodPut, url, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("PUT - Viewer role denied", func(t *testing.T) {
		dsUID := "test-ds-role-viewer-put"
		createTestDataSource(t, ctx, testEnv.Server.HTTPServer.DataSourcesService, dsUID, "Test DS for Viewer PUT")

		login := "viewer-user-put"
		password := "testpass"
		_ = tests.CreateUser(t, store, cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleViewer),
			Password:       user.Password(password),
			Login:          login,
			OrgID:          1,
		})

		updatePayload := map[string]any{
			"name":   "Updated by Viewer",
			"type":   "prometheus",
			"url":    "http://localhost:9091",
			"access": "proxy",
		}
		body, _ := json.Marshal(updatePayload)

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s", login, password, grafanaListeningAddr, dsUID)
		req, _ := http.NewRequest(http.MethodPut, url, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

// TestIntegrationDataSourceDeleteByUID tests the DELETE /api/datasources/uid/:uid endpoint.
//
// k8s-reroute DELETE handler is not implemented yet! This only tests the legacy mode.
func TestIntegrationDataSourceDeleteByUID(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})
	grafanaListeningAddr, testEnv := testinfra.StartGrafanaEnv(t, dir, path)
	ctx := context.Background()
	store := testEnv.SQLStore
	cfg := testEnv.Cfg

	t.Run("DELETE - succeeds", func(t *testing.T) {
		uid := "test-delete-ds"
		_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx,
			&datasources.AddDataSourceCommand{
				OrgID:  1,
				Access: datasources.DS_ACCESS_PROXY,
				Name:   "DS to Delete",
				Type:   datasources.DS_PROMETHEUS,
				UID:    uid,
				URL:    "http://localhost:9090",
			})
		require.NoError(t, err)

		url := fmt.Sprintf("http://admin:admin@%s/api/datasources/uid/%s", grafanaListeningAddr, uid)
		req, _ := http.NewRequest(http.MethodDelete, url, nil)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusOK, resp.StatusCode)

		getResp, err := http.Get(url)
		require.NoError(t, err)
		defer getResp.Body.Close()

		require.Equal(t, http.StatusNotFound, getResp.StatusCode)
	})

	t.Run("DELETE - not found", func(t *testing.T) {
		url := fmt.Sprintf("http://admin:admin@%s/api/datasources/uid/nonexistent-delete", grafanaListeningAddr)
		req, _ := http.NewRequest(http.MethodDelete, url, nil)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("DELETE - specific UID scope granted", func(t *testing.T) {
		dsUID := "test-ds-delete-perms-0"
		_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx,
			&datasources.AddDataSourceCommand{
				OrgID:  1,
				Access: datasources.DS_ACCESS_PROXY,
				Name:   "Test DS for Delete Permissions 0",
				Type:   datasources.DS_PROMETHEUS,
				UID:    dsUID,
				URL:    "http://localhost:9090",
			})
		require.NoError(t, err)

		login := "user-delete-0"
		password := "testpass"
		createUserWithPermissions(t, ctx, store, cfg, grafanaListeningAddr, login, []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{datasources.ActionDelete},
				Resource:          "datasources",
				ResourceAttribute: "uid",
				ResourceID:        dsUID,
			},
		})

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s",
			login, password, grafanaListeningAddr, dsUID)
		req, _ := http.NewRequest(http.MethodDelete, url, nil)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("DELETE - wildcard scope granted", func(t *testing.T) {
		dsUID := "test-ds-delete-perms-1"
		_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx,
			&datasources.AddDataSourceCommand{
				OrgID:  1,
				Access: datasources.DS_ACCESS_PROXY,
				Name:   "Test DS for Delete Permissions 1",
				Type:   datasources.DS_PROMETHEUS,
				UID:    dsUID,
				URL:    "http://localhost:9090",
			})
		require.NoError(t, err)

		login := "user-delete-1"
		password := "testpass"
		createUserWithPermissions(t, ctx, store, cfg, grafanaListeningAddr, login, []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{datasources.ActionDelete},
				Resource:          "datasources",
				ResourceAttribute: "uid",
				ResourceID:        "*",
			},
		})

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s",
			login, password, grafanaListeningAddr, dsUID)
		req, _ := http.NewRequest(http.MethodDelete, url, nil)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("DELETE - permission denied (wrong UID scope)", func(t *testing.T) {
		dsUID := "test-ds-delete-perms-2"
		_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx,
			&datasources.AddDataSourceCommand{
				OrgID:  1,
				Access: datasources.DS_ACCESS_PROXY,
				Name:   "Test DS for Delete Permissions 2",
				Type:   datasources.DS_PROMETHEUS,
				UID:    dsUID,
				URL:    "http://localhost:9090",
			})
		require.NoError(t, err)

		login := "user-delete-2"
		password := "testpass"
		createUserWithPermissions(t, ctx, store, cfg, grafanaListeningAddr, login, []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{datasources.ActionDelete},
				Resource:          "datasources",
				ResourceAttribute: "uid",
				ResourceID:        "other-uid",
			},
		})

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s",
			login, password, grafanaListeningAddr, dsUID)
		req, _ := http.NewRequest(http.MethodDelete, url, nil)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("DELETE - permission denied (read only)", func(t *testing.T) {
		dsUID := "test-ds-delete-perms-3"
		_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx,
			&datasources.AddDataSourceCommand{
				OrgID:  1,
				Access: datasources.DS_ACCESS_PROXY,
				Name:   "Test DS for Delete Permissions 3",
				Type:   datasources.DS_PROMETHEUS,
				UID:    dsUID,
				URL:    "http://localhost:9090",
			})
		require.NoError(t, err)

		login := "user-delete-3"
		password := "testpass"
		createUserWithPermissions(t, ctx, store, cfg, grafanaListeningAddr, login, []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{datasources.ActionRead},
				Resource:          "datasources",
				ResourceAttribute: "uid",
				ResourceID:        dsUID,
			},
		})

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s",
			login, password, grafanaListeningAddr, dsUID)
		req, _ := http.NewRequest(http.MethodDelete, url, nil)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("DELETE - permission denied (no permissions)", func(t *testing.T) {
		dsUID := "test-ds-delete-perms-4"
		_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx,
			&datasources.AddDataSourceCommand{
				OrgID:  1,
				Access: datasources.DS_ACCESS_PROXY,
				Name:   "Test DS for Delete Permissions 4",
				Type:   datasources.DS_PROMETHEUS,
				UID:    dsUID,
				URL:    "http://localhost:9090",
			})
		require.NoError(t, err)

		login := "user-delete-4"
		password := "testpass"
		createUserWithPermissions(t, ctx, store, cfg, grafanaListeningAddr, login, []resourcepermissions.SetResourcePermissionCommand{})

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s",
			login, password, grafanaListeningAddr, dsUID)
		req, _ := http.NewRequest(http.MethodDelete, url, nil)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	// Role-based DELETE tests
	t.Run("DELETE - Admin role succeeds", func(t *testing.T) {
		dsUID := "test-ds-role-admin-delete"
		createTestDataSource(t, ctx, testEnv.Server.HTTPServer.DataSourcesService, dsUID, "Test DS for Admin DELETE")

		login := "admin-user-delete"
		password := "testpass"
		_ = tests.CreateUser(t, store, cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleAdmin),
			Password:       user.Password(password),
			Login:          login,
			OrgID:          1,
		})

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s", login, password, grafanaListeningAddr, dsUID)
		req, _ := http.NewRequest(http.MethodDelete, url, nil)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("DELETE - Editor role denied", func(t *testing.T) {
		dsUID := "test-ds-role-editor-delete"
		createTestDataSource(t, ctx, testEnv.Server.HTTPServer.DataSourcesService, dsUID, "Test DS for Editor DELETE")

		login := "editor-user-delete"
		password := "testpass"
		_ = tests.CreateUser(t, store, cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleEditor),
			Password:       user.Password(password),
			Login:          login,
			OrgID:          1,
		})

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s", login, password, grafanaListeningAddr, dsUID)
		req, _ := http.NewRequest(http.MethodDelete, url, nil)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("DELETE - Viewer role denied", func(t *testing.T) {
		dsUID := "test-ds-role-viewer-delete"
		createTestDataSource(t, ctx, testEnv.Server.HTTPServer.DataSourcesService, dsUID, "Test DS for Viewer DELETE")

		login := "viewer-user-delete"
		password := "testpass"
		_ = tests.CreateUser(t, store, cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleViewer),
			Password:       user.Password(password),
			Login:          login,
			OrgID:          1,
		})

		url := fmt.Sprintf("http://%s:%s@%s/api/datasources/uid/%s", login, password, grafanaListeningAddr, dsUID)
		req, _ := http.NewRequest(http.MethodDelete, url, nil)

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

// createTestDataSource creates a datasource in the provided datasource service.
func createTestDataSource(t *testing.T, ctx context.Context, dsService datasources.DataSourceService, uid, name string) {
	t.Helper()
	_, err := dsService.AddDataSource(ctx, &datasources.AddDataSourceCommand{
		OrgID:  1,
		Access: datasources.DS_ACCESS_PROXY,
		Name:   name,
		Type:   datasources.DS_PROMETHEUS,
		UID:    uid,
		URL:    "http://localhost:9090",
	})
	require.NoError(t, err)
}

// createUserWithPermissions creates a user with the provided permissions
func createUserWithPermissions(
	t *testing.T,
	ctx context.Context,
	store db.DB,
	cfg *setting.Cfg,
	grafanaListeningAddr string,
	login string,
	permissions []resourcepermissions.SetResourcePermissionCommand,
) {
	t.Helper()
	password := "testpass"
	testUserId := tests.CreateUser(t, store, cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleNone),
		Password:       user.Password(password),
		Login:          login,
		OrgID:          1,
	})

	if len(permissions) > 0 {
		permissionsStore := resourcepermissions.NewStore(cfg, store, featuremgmt.WithFeatures())
		for _, cmd := range permissions {
			_, err := permissionsStore.SetUserResourcePermission(
				ctx,
				1,
				accesscontrol.User{ID: testUserId},
				cmd,
				nil,
			)
			require.NoError(t, err)
		}
	}

	// Reload permission cache
	cacheURL := fmt.Sprintf("http://%s:%s@%s/api/access-control/user/permissions?reloadcache=true",
		login, password, grafanaListeningAddr)
	cacheResp, err := http.Get(cacheURL)
	require.NoError(t, err)
	cacheResp.Body.Close()

}
