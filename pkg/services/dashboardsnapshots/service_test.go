package dashboardsnapshots

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	dashboardsnapshot "github.com/grafana/grafana/pkg/apis/dashboardsnapshot/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func TestCreateDashboardSnapshot_DashboardNotFound(t *testing.T) {
	mockService := &MockService{}
	cfg := dashboardsnapshot.SnapshotSharingOptions{
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
		DashboardCreateCommand: dashboardsnapshot.DashboardCreateCommand{
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
