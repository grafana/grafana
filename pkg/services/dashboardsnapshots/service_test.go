package dashboardsnapshots

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	snapshot "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func createTestDashboard(t *testing.T) *common.Unstructured {
	t.Helper()
	dashboard := &common.Unstructured{}
	dashboardData := map[string]any{
		"uid": "test-dashboard-uid",
		"id":  123,
	}
	dashboardBytes, _ := json.Marshal(dashboardData)
	_ = json.Unmarshal(dashboardBytes, dashboard)
	return dashboard
}

func createTestUser() *user.SignedInUser {
	return &user.SignedInUser{
		UserID: 1,
		OrgID:  1,
		Login:  "testuser",
		Name:   "Test User",
		Email:  "test@example.com",
	}
}

func createReqContext(t *testing.T, req *http.Request, testUser *user.SignedInUser) (*contextmodel.ReqContext, *httptest.ResponseRecorder) {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx := &contextmodel.ReqContext{
		Context: &web.Context{
			Req:  req,
			Resp: web.NewResponseWriter("POST", recorder),
		},
		SignedInUser: testUser,
		Logger:       log.NewNopLogger(),
	}
	return ctx, recorder
}

// TestCreateDashboardSnapshot tests snapshot creation in regular mode (non-public instance).
// These tests cover scenarios when Grafana is running as a regular server with user authentication.
func TestCreateDashboardSnapshot(t *testing.T) {
	t.Run("should return error when dashboard not found", func(t *testing.T) {
		mockService := &MockService{}
		cfg := snapshot.SnapshotSharingOptions{
			SnapshotsEnabled: true,
			ExternalEnabled:  false,
		}
		testUser := createTestUser()
		dashboard := createTestDashboard(t)

		cmd := CreateDashboardSnapshotCommand{
			DashboardCreateCommand: snapshot.DashboardCreateCommand{
				Dashboard: dashboard,
				Name:      "Test Snapshot",
			},
		}

		mockService.On("ValidateDashboardExists", mock.Anything, int64(1), "test-dashboard-uid").
			Return(dashboards.ErrDashboardNotFound)

		req, _ := http.NewRequest("POST", "/api/snapshots", nil)
		req = req.WithContext(identity.WithRequester(req.Context(), testUser))
		ctx, recorder := createReqContext(t, req, testUser)

		CreateDashboardSnapshot(ctx, cfg, cmd, mockService)

		mockService.AssertExpectations(t)
		assert.Equal(t, http.StatusBadRequest, recorder.Code)
		var response map[string]any
		err := json.Unmarshal(recorder.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Equal(t, "Dashboard not found", response["message"])
	})

	t.Run("should create external snapshot when external is enabled", func(t *testing.T) {
		externalServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "/api/snapshots", r.URL.Path)
			assert.Equal(t, "POST", r.Method)

			response := map[string]any{
				"key":       "external-key",
				"deleteKey": "external-delete-key",
				"url":       "https://external.example.com/dashboard/snapshot/external-key",
				"deleteUrl": "https://external.example.com/api/snapshots-delete/external-delete-key",
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(response)
		}))
		defer externalServer.Close()

		mockService := NewMockService(t)
		cfg := snapshot.SnapshotSharingOptions{
			SnapshotsEnabled:    true,
			ExternalEnabled:     true,
			ExternalSnapshotURL: externalServer.URL,
		}
		testUser := createTestUser()
		dashboard := createTestDashboard(t)

		cmd := CreateDashboardSnapshotCommand{
			DashboardCreateCommand: snapshot.DashboardCreateCommand{
				Dashboard: dashboard,
				Name:      "Test External Snapshot",
				External:  true,
			},
		}

		mockService.On("ValidateDashboardExists", mock.Anything, int64(1), "test-dashboard-uid").
			Return(nil)
		mockService.On("CreateDashboardSnapshot", mock.Anything, mock.Anything).
			Return(&DashboardSnapshot{
				Key:       "external-key",
				DeleteKey: "external-delete-key",
			}, nil)

		req, _ := http.NewRequest("POST", "/api/snapshots", nil)
		req = req.WithContext(identity.WithRequester(req.Context(), testUser))
		ctx, recorder := createReqContext(t, req, testUser)

		CreateDashboardSnapshot(ctx, cfg, cmd, mockService)

		mockService.AssertExpectations(t)
		assert.Equal(t, http.StatusOK, recorder.Code)

		var response map[string]any
		err := json.Unmarshal(recorder.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Equal(t, "external-key", response["key"])
		assert.Equal(t, "external-delete-key", response["deleteKey"])
		assert.Equal(t, "https://external.example.com/dashboard/snapshot/external-key", response["url"])
	})

	t.Run("should return forbidden when external is disabled", func(t *testing.T) {
		mockService := NewMockService(t)
		cfg := snapshot.SnapshotSharingOptions{
			SnapshotsEnabled: true,
			ExternalEnabled:  false,
		}
		testUser := createTestUser()
		dashboard := createTestDashboard(t)

		cmd := CreateDashboardSnapshotCommand{
			DashboardCreateCommand: snapshot.DashboardCreateCommand{
				Dashboard: dashboard,
				Name:      "Test External Snapshot",
				External:  true,
			},
		}

		mockService.On("ValidateDashboardExists", mock.Anything, int64(1), "test-dashboard-uid").
			Return(nil)

		req, _ := http.NewRequest("POST", "/api/snapshots", nil)
		req = req.WithContext(identity.WithRequester(req.Context(), testUser))
		ctx, recorder := createReqContext(t, req, testUser)

		CreateDashboardSnapshot(ctx, cfg, cmd, mockService)

		mockService.AssertExpectations(t)
		assert.Equal(t, http.StatusForbidden, recorder.Code)

		var response map[string]any
		err := json.Unmarshal(recorder.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Equal(t, "External dashboard creation is disabled", response["message"])
	})

	t.Run("should create local snapshot", func(t *testing.T) {
		mockService := NewMockService(t)
		cfg := snapshot.SnapshotSharingOptions{
			SnapshotsEnabled: true,
		}
		testUser := createTestUser()
		dashboard := createTestDashboard(t)

		cmd := CreateDashboardSnapshotCommand{
			DashboardCreateCommand: snapshot.DashboardCreateCommand{
				Dashboard: dashboard,
				Name:      "Test Local Snapshot",
			},
			Key:       "local-key",
			DeleteKey: "local-delete-key",
		}

		mockService.On("ValidateDashboardExists", mock.Anything, int64(1), "test-dashboard-uid").
			Return(nil)
		mockService.On("CreateDashboardSnapshot", mock.Anything, mock.Anything).
			Return(&DashboardSnapshot{
				Key:       "local-key",
				DeleteKey: "local-delete-key",
			}, nil)

		req, _ := http.NewRequest("POST", "/api/snapshots", nil)
		req = req.WithContext(identity.WithRequester(req.Context(), testUser))
		ctx, recorder := createReqContext(t, req, testUser)

		CreateDashboardSnapshot(ctx, cfg, cmd, mockService)

		mockService.AssertExpectations(t)
		assert.Equal(t, http.StatusOK, recorder.Code)

		var response map[string]any
		err := json.Unmarshal(recorder.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Equal(t, "local-key", response["key"])
		assert.Equal(t, "local-delete-key", response["deleteKey"])
		assert.Contains(t, response["url"], "dashboard/snapshot/local-key")
		assert.Contains(t, response["deleteUrl"], "api/snapshots-delete/local-delete-key")
	})
}

// TestCreateDashboardSnapshotPublic tests snapshot creation in public mode.
// These tests cover scenarios when Grafana is running as a public snapshot server
// where no user authentication or dashboard validation is required.
func TestCreateDashboardSnapshotPublic(t *testing.T) {
	t.Run("should create local snapshot without user context", func(t *testing.T) {
		mockService := NewMockService(t)
		cfg := snapshot.SnapshotSharingOptions{
			SnapshotsEnabled: true,
		}
		dashboard := createTestDashboard(t)

		cmd := CreateDashboardSnapshotCommand{
			DashboardCreateCommand: snapshot.DashboardCreateCommand{
				Dashboard: dashboard,
				Name:      "Test Snapshot",
			},
			Key:       "test-key",
			DeleteKey: "test-delete-key",
		}

		mockService.On("CreateDashboardSnapshot", mock.Anything, mock.Anything).
			Return(&DashboardSnapshot{
				Key:       "test-key",
				DeleteKey: "test-delete-key",
			}, nil)

		req, _ := http.NewRequest("POST", "/api/snapshots", nil)
		recorder := httptest.NewRecorder()
		ctx := &contextmodel.ReqContext{
			Context: &web.Context{
				Req:  req,
				Resp: web.NewResponseWriter("POST", recorder),
			},
			Logger: log.NewNopLogger(),
		}

		CreateDashboardSnapshotPublic(ctx, cfg, cmd, mockService)

		mockService.AssertExpectations(t)
		assert.Equal(t, http.StatusOK, recorder.Code)

		var response map[string]any
		err := json.Unmarshal(recorder.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Equal(t, "test-key", response["key"])
		assert.Equal(t, "test-delete-key", response["deleteKey"])
		assert.Contains(t, response["url"], "dashboard/snapshot/test-key")
		assert.Contains(t, response["deleteUrl"], "api/snapshots-delete/test-delete-key")
	})

	t.Run("should return forbidden when snapshots are disabled", func(t *testing.T) {
		mockService := NewMockService(t)
		cfg := snapshot.SnapshotSharingOptions{
			SnapshotsEnabled: false,
		}
		dashboard := createTestDashboard(t)

		cmd := CreateDashboardSnapshotCommand{
			DashboardCreateCommand: snapshot.DashboardCreateCommand{
				Dashboard: dashboard,
				Name:      "Test Snapshot",
			},
		}

		req, _ := http.NewRequest("POST", "/api/snapshots", nil)
		recorder := httptest.NewRecorder()
		ctx := &contextmodel.ReqContext{
			Context: &web.Context{
				Req:  req,
				Resp: web.NewResponseWriter("POST", recorder),
			},
			Logger: log.NewNopLogger(),
		}

		CreateDashboardSnapshotPublic(ctx, cfg, cmd, mockService)

		assert.Equal(t, http.StatusForbidden, recorder.Code)

		var response map[string]any
		err := json.Unmarshal(recorder.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Equal(t, "Dashboard Snapshots are disabled", response["message"])
	})
}

// TestDeleteExternalDashboardSnapshot tests deletion of external snapshots.
// This function is called in public mode and doesn't require user context.
func TestDeleteExternalDashboardSnapshot(t *testing.T) {
	t.Run("should return nil on successful deletion", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "GET", r.Method)
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		err := DeleteExternalDashboardSnapshot(server.URL)
		assert.NoError(t, err)
	})

	t.Run("should gracefully handle already deleted snapshot", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			response := map[string]any{
				"message": "Failed to get dashboard snapshot",
			}
			_ = json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		err := DeleteExternalDashboardSnapshot(server.URL)
		assert.NoError(t, err)
	})

	t.Run("should return error on unexpected status code", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotFound)
		}))
		defer server.Close()

		err := DeleteExternalDashboardSnapshot(server.URL)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "unexpected response when deleting external snapshot")
		assert.Contains(t, err.Error(), "404")
	})

	t.Run("should return error on 500 with different message", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			response := map[string]any{
				"message": "Some other error",
			}
			_ = json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		err := DeleteExternalDashboardSnapshot(server.URL)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "500")
	})
}
