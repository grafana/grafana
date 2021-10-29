package serviceaccounts

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/api"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/database"
	"github.com/grafana/grafana/pkg/setting"
)

type Service interface {
	DeleteServiceAccount(context.Context, int64) error
}

type ServiceAccountsService struct {
	store          database.ServiceAccountsStoreImpl
	bus            bus.Bus
	cfg            *setting.Cfg
	routerRegister routing.RouteRegister
	log            log.Logger
}

func ProvideServiceAccountsService(
	bus bus.Bus,
	cfg *setting.Cfg,
	store database.ServiceAccountsStoreImpl,
	routeRegister routing.RouteRegister,
) (*ServiceAccountsService, error) {
	s := &ServiceAccountsService{
		store:          store,
		bus:            bus,
		cfg:            cfg,
		routerRegister: routeRegister,
		log:            log.New("serviceaccounts"),
	}

	if !cfg.FeatureToggles["service-accounts"] {
		return nil, ErrServiceAccountsFeatureToggleNotFound
	}

	serviceaccountsAPI := api.NewServiceAccountsAPI(s.store, s.routerRegister)
	serviceaccountsAPI.RegisterAPIEndpoints()
	return s, nil
}

func (s *ServiceAccountsService) DeleteServiceAccount(c *models.ReqContext) response.Response {
	serviceAccountId := c.ParamsInt64(":serviceAccountId")
	err := s.store.DeleteServiceAccount(c.Req.Context(), serviceAccountId)
	if err != nil {
		return response.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to delete service account for serviceAccountId %d", serviceAccountId), err)
	}
	return response.Success("Service account removed.")
}
