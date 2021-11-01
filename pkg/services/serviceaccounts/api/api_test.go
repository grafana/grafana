package api

import (
	"testing"

	"github.com/grafana/grafana/pkg/api/routing"
	infralog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"

	"github.com/grafana/grafana/pkg/services/serviceaccounts/database"
	"github.com/grafana/grafana/pkg/setting"
	"gopkg.in/macaron.v1"
)

func TestAPIEndpoints_DeleteServiceAccount(t *testing.T) {
	t.Run("should delete service account", func(t *testing.T) {
		cases := []struct {
			name     string
			expected string
		}{
			{
				name:     "should delete service account",
				expected: "",
			},
		}
	})
}

func setupServer(t *testing.T, disableAccessControl bool) (*macaron.Macaron, *database.MockDatasourceDatabase, *accesscontrolmock.Mock) {
	t.Helper()
	db := new(database.MockDatasourceDatabase)
	acmock := accesscontrolmock.New()
	if disableAccessControl {
		acmock = acmock.WithDisabled()
	}
	api := NewServiceAccountsAPI(db, &setting.Cfg{FeatureToggles: map[string]bool{"service-accounts": true}}, routing.NewRouteRegister(), acmock)
	api.RegisterAPIEndpoints()

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
	api.routerRegister.Register(m.Router)
	return m, db, acmock
}
