package publicdashboards

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/user"
)

// These are the api contracts. The API should match the underlying service and store

//go:generate go run ./commands/generate_datasources/main.go
//go:generate mockery --name Service --structname FakePublicDashboardService --inpackage --filename public_dashboard_service_mock.go
type Service interface {
	GetPublicDashboardForView(ctx context.Context, accessToken string) (*dtos.DashboardFullWithMeta, error)
	FindPublicDashboardAndDashboardByAccessToken(ctx context.Context, accessToken string) (*PublicDashboard, *dashboards.Dashboard, error)
	FindEnabledPublicDashboardAndDashboardByAccessToken(ctx context.Context, accessToken string) (*PublicDashboard, *dashboards.Dashboard, error)
	FindByAccessToken(ctx context.Context, accessToken string) (*PublicDashboard, error)
	FindByDashboardUid(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error)
	FindAnnotations(ctx context.Context, reqDTO AnnotationsQueryDTO, accessToken string) ([]AnnotationEvent, error)
	FindDashboard(ctx context.Context, orgId int64, dashboardUid string) (*dashboards.Dashboard, error)
	FindAllWithPagination(ctx context.Context, query *PublicDashboardListQuery) (*PublicDashboardListResponseWithPagination, error)
	Find(ctx context.Context, uid string) (*PublicDashboard, error)
	Create(ctx context.Context, u *user.SignedInUser, dto *SavePublicDashboardDTO) (*PublicDashboard, error)
	Update(ctx context.Context, u *user.SignedInUser, dto *SavePublicDashboardDTO) (*PublicDashboard, error)
	Delete(ctx context.Context, uid string, dashboardUid string) error

	GetMetricRequest(ctx context.Context, dashboard *dashboards.Dashboard, publicDashboard *PublicDashboard, panelId int64, reqDTO PublicDashboardQueryDTO) (dtos.MetricRequest, error)
	GetQueryDataResponse(ctx context.Context, skipDSCache bool, reqDTO PublicDashboardQueryDTO, panelId int64, accessToken string) (*backend.QueryDataResponse, error)
	GetOrgIdByAccessToken(ctx context.Context, accessToken string) (int64, error)
	NewPublicDashboardAccessToken(ctx context.Context) (string, error)
	NewPublicDashboardUid(ctx context.Context) (string, error)

	ExistsEnabledByAccessToken(ctx context.Context, accessToken string) (bool, error)
	ExistsEnabledByDashboardUid(ctx context.Context, dashboardUid string) (bool, error)
}

// ServiceWrapper these methods have different behavior between OSS and Enterprise. The latter would call the OSS service first
//
//go:generate mockery --name ServiceWrapper --structname FakePublicDashboardServiceWrapper --inpackage --filename public_dashboard_service_wrapper_mock.go
type ServiceWrapper interface {
	FindByDashboardUid(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error)
	Delete(ctx context.Context, uid string) error
	DeleteByDashboardUIDs(ctx context.Context, orgId int64, dashboardUIDs []string) error
}

//go:generate mockery --name Store --structname FakePublicDashboardStore --inpackage --filename public_dashboard_store_mock.go
type Store interface {
	Find(ctx context.Context, uid string) (*PublicDashboard, error)
	FindByAccessToken(ctx context.Context, accessToken string) (*PublicDashboard, error)
	FindByDashboardUid(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error)
	FindAll(ctx context.Context, query *PublicDashboardListQuery) (*PublicDashboardListResponseWithPagination, error)
	Create(ctx context.Context, cmd SavePublicDashboardCommand) (int64, error)
	Update(ctx context.Context, cmd SavePublicDashboardCommand) (int64, error)
	Delete(ctx context.Context, uid string) (int64, error)
	DeleteByDashboardUIDs(ctx context.Context, orgId int64, dashboardUIDs []string) error

	GetOrgIdByAccessToken(ctx context.Context, accessToken string) (int64, error)
	ExistsEnabledByAccessToken(ctx context.Context, accessToken string) (bool, error)
	ExistsEnabledByDashboardUid(ctx context.Context, dashboardUid string) (bool, error)
	GetMetrics(ctx context.Context) (*Metrics, error)
}

//go:generate mockery --name Middleware --structname FakePublicDashboardMiddleware --inpackage --filename public_dashboard_middleware_mock.go
type Middleware interface {
	HandleApi(c *contextmodel.ReqContext)
	HandleView(c *contextmodel.ReqContext)
	HandleAccessView(c *contextmodel.ReqContext)
	HandleConfirmAccessView(c *contextmodel.ReqContext)
}
