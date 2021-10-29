package api

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/database"
)

type ServiceAccountsAPI struct {
	sqlStore      database.ServiceAccountsStoreImpl
	routeRegister routing.RouteRegister
}

func NewServiceAccountsAPI(
	serviceaccountDatabase database.ServiceAccountsStoreImpl,
	routerRegister routing.RouteRegister,
) *ServiceAccountsAPI {
	return &ServiceAccountsAPI{
		sqlStore:      serviceaccountDatabase,
		routeRegister: routerRegister,
	}
}

func (api *ServiceAccountsAPI) RegisterAPIEndpoints() {

}
