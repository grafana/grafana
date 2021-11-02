package manager

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/api"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
	"gopkg.in/macaron.v1"

	infralog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
)

var (
	deletePermissionPath = "/api/serviceaccounts/%s"
)

func TestService_DeleteServiceAccount(t *testing.T) {
	routerRegister := routing.NewRouteRegister()
	svc, acmock := setupTestService(t, routerRegister, false)
	server := setupServer(t, svc, routerRegister, acmock, false)

	var getResponse = func() *httptest.ResponseRecorder {
		req, err := http.NewRequest(http.MethodDelete, fmt.Sprintf(deletePermissionPath, "1"), nil)
		require.NoError(t, err)
		recorder := httptest.NewRecorder()
		server.ServeHTTP(recorder, req)
		return recorder
	}

	t.Run("Service account is deleted successfully", func(t *testing.T) {
		require.Equal(t, getResponse().Code, http.StatusOK)
	})
}

func setupTestService(t *testing.T, routerRegister routing.RouteRegister, disableAccessControl bool) (*ServiceAccountsService, *accesscontrolmock.Mock) {
	t.Helper()
	acmock := accesscontrolmock.New()
	if disableAccessControl {
		acmock = acmock.WithDisabled()
	}
	svc, err := ProvideServiceAccountsService(
		&setting.Cfg{FeatureToggles: map[string]bool{"service-accounts": true}},
		sqlstore.InitTestDB(t),
		acmock,
		routerRegister,
	)
	if err != nil {
		t.Fatalf("serviceaccounts service could not be created")
	}
	return svc, acmock
}

func setupServer(t *testing.T, svc *ServiceAccountsService, routerRegister routing.RouteRegister, acmock *accesscontrolmock.Mock, disableAccessControl bool) *macaron.Macaron {
	a := api.NewServiceAccountsAPI(
		svc,
		acmock,
		routerRegister,
	)
	a.RegisterAPIEndpoints()

	m := macaron.New()
	signedUser := &models.SignedInUser{
		OrgId:   1,
		OrgRole: models.ROLE_ADMIN,
	}

	m.Use(func(c *macaron.Context) {
		ctx := &models.ReqContext{
			Context:      c,
			IsSignedIn:   true,
			SignedInUser: signedUser,
			Logger:       infralog.New("serviceaccounts-test"),
		}
		c.Map(ctx)
	})
	a.RouterRegister.Register(m.Router)
	return m
}
