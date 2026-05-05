package publicdashboards

import (
	publicdashboards "github.com/grafana/grafana/pkg/services/publicdashboards/internal"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal/api"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal/database"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal/metric"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal/service"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal/validation"
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
	ProvideMiddleware                = api.ProvideMiddleware
	ProvideApi                       = api.ProvideApi
	RequiresExistingAccessToken      = api.RequiresExistingAccessToken

	NewFakePublicDashboardMiddleware     = publicdashboards.NewFakePublicDashboardMiddleware
	NewFakePublicDashboardService        = publicdashboards.NewFakePublicDashboardService
	NewFakePublicDashboardServiceWrapper = publicdashboards.NewFakePublicDashboardServiceWrapper

	ProvideStore = database.ProvideStore

	IsValidShortUID    = validation.IsValidShortUID
	IsValidAccessToken = validation.IsValidAccessToken

	GenerateAccessToken   = service.GenerateAccessToken
	ProvideService        = service.ProvideService
	ProvideServiceWrapper = service.ProvideServiceWrapper

	ProvideMetricsService = metric.ProvideService
)
