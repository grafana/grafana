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
