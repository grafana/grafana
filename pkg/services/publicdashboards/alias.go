package publicdashboards

import (
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	publicdashboards "github.com/grafana/grafana/pkg/services/publicdashboards/internal"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal/api"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal/database"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal/metric"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal/service"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal/validation"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	ActionDashboardsPublicWrite = publicdashboards.ActionDashboardsPublicWrite

	FeaturePublicDashboardsEmailSharing = models.FeaturePublicDashboardsEmailSharing
	EmailShareType                      = models.EmailShareType
	PublicShareType                     = models.PublicShareType
)

type (
	Service                           = publicdashboards.Service
	FakePublicDashboardService        = publicdashboards.FakePublicDashboardService
	Middleware                        = publicdashboards.Middleware
	ServiceWrapper                    = publicdashboards.ServiceWrapper
	Store                             = publicdashboards.Store
	FakePublicDashboardServiceWrapper = publicdashboards.FakePublicDashboardServiceWrapper

	PublicDashboardServiceWrapperImpl = service.PublicDashboardServiceWrapperImpl
	PublicDashboardServiceImpl        = service.PublicDashboardServiceImpl

	Api            = api.Api
	MiddlewareImpl = api.Middleware

	PublicDashboard            = models.PublicDashboard
	SavePublicDashboardCommand = models.SavePublicDashboardCommand
	PublicDashboardDTO         = models.PublicDashboardDTO
	EmailDTO                   = models.EmailDTO
	TimeSettings               = models.TimeSettings

	PublicDashboardStoreImpl = database.PublicDashboardStoreImpl

	MetricsService = metric.Service
)

var (
	ErrPublicDashboardNotFound = models.ErrPublicDashboardNotFound
	ErrBadRequest              = models.ErrBadRequest
	ErrInvalidUid              = models.ErrInvalidUid
	ErrInvalidAccessToken      = models.ErrInvalidAccessToken
	ErrInternalServerError     = models.ErrInternalServerError

	SetPublicDashboardAccessToken    = api.SetPublicDashboardAccessToken
	SetPublicDashboardOrgIdOnContext = api.SetPublicDashboardOrgIdOnContext
	CountPublicDashboardRequest      = api.CountPublicDashboardRequest
	RequiresExistingAccessToken      = api.RequiresExistingAccessToken

	NewFakePublicDashboardMiddleware     = publicdashboards.NewFakePublicDashboardMiddleware
	NewFakePublicDashboardService        = publicdashboards.NewFakePublicDashboardService
	NewFakePublicDashboardServiceWrapper = publicdashboards.NewFakePublicDashboardServiceWrapper

	IsValidShortUID    = validation.IsValidShortUID
	IsValidAccessToken = validation.IsValidAccessToken

	GenerateAccessToken = service.GenerateAccessToken
)

// Keep Wire providers as wrapper funcs (not var aliases) so generated code stays in this package and does not import internal/* directly.
func ProvideStore(sqlStore db.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles) Store {
	return database.ProvideStore(sqlStore, cfg, features)
}

func ProvideService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	store Store,
	qds query.Service,
	anno annotations.Repository,
	ac accesscontrol.AccessControl,
	serviceWrapper ServiceWrapper,
	dashboardService dashboards.DashboardService,
	license licensing.Licensing,
) Service {
	return service.ProvideService(cfg, features, store, qds, anno, ac, serviceWrapper, dashboardService, license)
}

func ProvideServiceWrapper(store Store) ServiceWrapper {
	return service.ProvideServiceWrapper(store)
}

func ProvideServiceWrapperImpl(store Store) *PublicDashboardServiceWrapperImpl {
	return service.ProvideServiceWrapper(store)
}

func ProvideMetricsService(store Store, prom prometheus.Registerer) (*metric.Service, error) {
	return metric.ProvideService(store, prom)
}

func ProvideMiddleware() Middleware {
	return api.ProvideMiddleware()
}

func ProvideApi(
	pd Service,
	rr routing.RouteRegister,
	ac accesscontrol.AccessControl,
	features featuremgmt.FeatureToggles,
	md Middleware,
	cfg *setting.Cfg,
	license licensing.Licensing,
) *Api {
	return api.ProvideApi(pd, rr, ac, features, md, cfg, license)
}
