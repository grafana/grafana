package ossaccesscontrol

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/web"
)

type noopDashboardPermissionsRegistration struct {
	dashboards.PermissionsRegistrationService
}

func (noopDashboardPermissionsRegistration) RegisterDashboardPermissions(accesscontrol.DashboardPermissionsService) {
}

func TestIntegrationDashboardPermissionsMissingFolderIsConflict(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	dashboardSvc := dashboards.NewFakeDashboardService(t)
	dashboardSvc.On("GetDashboard", mock.Anything, mock.Anything).
		Return(&dashboards.Dashboard{UID: "dash", OrgID: 1, FolderUID: "gone"}, nil)
	// Same shape as the unified store error for a missing folder.
	folderSvc := &foldertest.FakeService{
		ExpectedError: folder.ErrFolderNotFound.Errorf("%w", dashboards.ErrFolderNotFound),
	}

	router := routing.NewRouteRegister()
	_, err := ProvideDashboardPermissions(
		setting.NewCfg(), featuremgmt.WithFeatures(), router, sqlstore.NewTestStore(t),
		actest.FakeAccessControl{ExpectedEvaluate: true}, iam.Features{}, &licensing.OSSLicensingService{},
		dashboardSvc, folderSvc, &actest.FakeService{}, nil, nil, nil,
		resourcepermissions.NewActionSetService(), noopDashboardPermissionsRegistration{}, nil,
	)
	require.NoError(t, err)

	server := web.New()
	server.UseMiddleware(web.Renderer("views", "[[", "]]"))
	server.Use(func(c *web.Context) {
		reqCtx := &contextmodel.ReqContext{
			Context:      c,
			SignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: org.RoleAdmin},
			IsSignedIn:   true,
			Logger:       log.New("test"),
		}
		c.Req = c.Req.WithContext(ctxkey.Set(c.Req.Context(), reqCtx))
	})
	router.Register(server)

	req := httptest.NewRequest(http.MethodGet, "/api/access-control/dashboards/dash", nil)
	rec := httptest.NewRecorder()
	server.ServeHTTP(rec, req)

	require.Equal(t, http.StatusConflict, rec.Code, rec.Body.String())
	var body struct {
		Message   string `json:"message"`
		MessageID string `json:"messageId"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Equal(t, "Dashboard permissions cannot be resolved: the dashboard's folder does not exist", body.Message)
	require.Equal(t, "dashboards.folder-not-found", body.MessageID)
}
