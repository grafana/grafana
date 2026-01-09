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

func TestCreateDashboardSnapshot_DashboardNotFound(t *testing.T) {
	mockService := &MockService{}
	cfg := snapshot.SnapshotSharingOptions{
		SnapshotsEnabled: true,
		ExternalEnabled:  false,
	}
	testUser := &user.SignedInUser{
		UserID: 1,
		OrgID:  1,
		Login:  "testuser",
		Name:   "Test User",
		Email:  "test@example.com",
	}
	dashboard := &common.Unstructured{}
	dashboardData := map[string]interface{}{
		"uid": "test-dashboard-uid",
		"id":  123,
	}
	dashboardBytes, _ := json.Marshal(dashboardData)
	_ = json.Unmarshal(dashboardBytes, dashboard)

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

	recorder := httptest.NewRecorder()
	ctx := &contextmodel.ReqContext{
		Context: &web.Context{
			Req:  req,
			Resp: web.NewResponseWriter("POST", recorder),
		},
		SignedInUser: testUser,
		Logger:       log.NewNopLogger(),
	}

	CreateDashboardSnapshot(ctx, cfg, cmd, mockService)

	mockService.AssertExpectations(t)
	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	var response map[string]interface{}
	err := json.Unmarshal(recorder.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "Dashboard not found", response["message"])
}

func TestCreateDashboardSnapshot_PublicModeSkipsValidation(t *testing.T) {
	mockService := NewMockService(t)
	cfg := snapshot.SnapshotSharingOptions{
		SnapshotsEnabled: true,
		ExternalEnabled:  false,
		PublicMode:       true,
	}
	testUser := &user.SignedInUser{
		UserID: 1,
		OrgID:  1,
		Login:  "testuser",
		Name:   "Test User",
		Email:  "test@example.com",
	}
	dashboard := &common.Unstructured{}
	dashboardData := map[string]interface{}{
		"uid": "test-dashboard-uid",
		"id":  123,
	}
	dashboardBytes, _ := json.Marshal(dashboardData)
	_ = json.Unmarshal(dashboardBytes, dashboard)

	cmd := CreateDashboardSnapshotCommand{
		DashboardCreateCommand: snapshot.DashboardCreateCommand{
			Dashboard: dashboard,
			Name:      "Test Snapshot",
		},
	}

	// Mock CreateDashboardSnapshot to return a successful result
	mockService.On("CreateDashboardSnapshot", mock.Anything, mock.Anything).
		Return(&DashboardSnapshot{
			Key:       "test-key",
			DeleteKey: "test-delete-key",
		}, nil)

	req, _ := http.NewRequest("POST", "/api/snapshots", nil)
	req = req.WithContext(identity.WithRequester(req.Context(), testUser))

	recorder := httptest.NewRecorder()
	ctx := &contextmodel.ReqContext{
		Context: &web.Context{
			Req:  req,
			Resp: web.NewResponseWriter("POST", recorder),
		},
		SignedInUser: testUser,
		Logger:       log.NewNopLogger(),
	}

	// Call with snapshotsPublicMode = true
	CreateDashboardSnapshot(ctx, cfg, cmd, mockService)

	// Verify ValidateDashboardExists was NOT called when in public mode
	mockService.AssertNotCalled(t, "ValidateDashboardExists", mock.Anything, mock.Anything, mock.Anything)

	assert.Equal(t, http.StatusOK, recorder.Code)
}
