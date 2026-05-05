package publicdashboards

import (
	"testing"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	publicdashboards "github.com/grafana/grafana/pkg/services/publicdashboards/internal"
	api "github.com/grafana/grafana/pkg/services/publicdashboards/internal/api"
	database "github.com/grafana/grafana/pkg/services/publicdashboards/internal/database"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal/metric"
	metrics "github.com/grafana/grafana/pkg/services/publicdashboards/internal/metric"
	models "github.com/grafana/grafana/pkg/services/publicdashboards/internal/models"
	service "github.com/grafana/grafana/pkg/services/publicdashboards/internal/service"
	validation "github.com/grafana/grafana/pkg/services/publicdashboards/internal/validation"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	ActionDashboardsPublicWrite         = publicdashboards.ActionDashboardsPublicWrite
	FeaturePublicDashboardsEmailSharing = models.FeaturePublicDashboardsEmailSharing
	EmailShareType                      = models.EmailShareType
	PublicShareType                     = models.PublicShareType
)

type (
	FakePublicDashboardService        = publicdashboards.FakePublicDashboardService
	Api                               = api.Api
	MiddlewareImpl                    = api.Middleware
	Service                           = publicdashboards.Service
	PublicDashboard                   = models.PublicDashboard
	SavePublicDashboardCommand        = models.SavePublicDashboardCommand
	PublicDashboardDTO                = models.PublicDashboardDTO
	EmailDTO                          = models.EmailDTO
	Middleware                        = publicdashboards.Middleware
	ServiceWrapper                    = publicdashboards.ServiceWrapper
	PublicDashboardStoreImpl          = database.PublicDashboardStoreImpl
	TimeSettings                      = models.TimeSettings
	Store                             = publicdashboards.Store
	FakePublicDashboardServiceWrapper = publicdashboards.FakePublicDashboardServiceWrapper
	MetricsService                    = metrics.Service
	PublicDashboardServiceWrapperImpl = service.PublicDashboardServiceWrapperImpl
	PublicDashboardServiceImpl        = service.PublicDashboardServiceImpl
)

var (
	ErrPublicDashboardNotFound = models.ErrPublicDashboardNotFound
	ErrBadRequest              = models.ErrBadRequest
	ErrInvalidUid              = models.ErrInvalidUid
	ErrInvalidAccessToken      = models.ErrInvalidAccessToken
	ErrInternalServerError     = models.ErrInternalServerError
)

func SetPublicDashboardAccessToken(c *contextmodel.ReqContext) {
	api.SetPublicDashboardAccessToken(c)
}

func SetPublicDashboardOrgIdOnContext(publicDashboardService publicdashboards.Service) func(c *contextmodel.ReqContext) {
	return api.SetPublicDashboardOrgIdOnContext(publicDashboardService)
}

func CountPublicDashboardRequest() func(c *contextmodel.ReqContext) {
	return api.CountPublicDashboardRequest()
}

func ProvideMiddleware() *MiddlewareImpl {
	return api.ProvideMiddleware()
}

func ProvideApi(publicDashboardService publicdashboards.Service, rr routing.RouteRegister, ac accesscontrol.AccessControl, features featuremgmt.FeatureToggles, md publicdashboards.Middleware, cfg *setting.Cfg, license licensing.Licensing) *api.Api {
	return api.ProvideApi(publicDashboardService, rr, ac, features, md, cfg, license)
}

func NewFakePublicDashboardMiddleware(t *testing.T) *publicdashboards.FakePublicDashboardMiddleware {
	return publicdashboards.NewFakePublicDashboardMiddleware(t)
}

func RequiresExistingAccessToken(publicDashboardService publicdashboards.Service) func(c *contextmodel.ReqContext) {
	return api.RequiresExistingAccessToken(publicDashboardService)
}

func ProvideStore(db db.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles) *PublicDashboardStoreImpl {
	return database.ProvideStore(db, cfg, features)
}

func NewFakePublicDashboardService(t *testing.T) *publicdashboards.FakePublicDashboardService {
	return publicdashboards.NewFakePublicDashboardService(t)
}

func IsValidShortUID(uid string) bool {
	return validation.IsValidShortUID(uid)
}

func IsValidAccessToken(token string) bool {
	return validation.IsValidAccessToken(token)
}

func GenerateAccessToken() (string, error) {
	return service.GenerateAccessToken()
}

func NewFakePublicDashboardServiceWrapper(t *testing.T) *publicdashboards.FakePublicDashboardServiceWrapper {
	return publicdashboards.NewFakePublicDashboardServiceWrapper(t)
}

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, store publicdashboards.Store, qds query.Service, anno annotations.Repository, ac accesscontrol.AccessControl, serviceWrapper publicdashboards.ServiceWrapper, dashboardService dashboards.DashboardService, license licensing.Licensing) *PublicDashboardServiceImpl {
	return service.ProvideService(cfg, features, store, qds, anno, ac, serviceWrapper, dashboardService, license)
}

func ProvideServiceWrapper(store publicdashboards.Store) *PublicDashboardServiceWrapperImpl {
	return service.ProvideServiceWrapper(store)
}

func ProvideMetricsService(store publicdashboards.Store, prom prometheus.Registerer) (*metric.Service, error) {
	return metric.ProvideService(store, prom)
}
