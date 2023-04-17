package publicdashboards

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/services/dashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/user"
)

// These are the api contracts. The API should match the underlying service and store

//go:generate go run ./commands/generate_datasources/main.go
//go:generate mockery --name Service --structname FakePublicDashboardService --inpackage --filename public_dashboard_service_mock.go
type Service interface {
	FindPublicDashboardAndDashboardByAccessToken(ctx context.Context, accessToken string) (*PublicDashboard, *dashboards.Dashboard, error)
	FindEnabledPublicDashboardAndDashboardByAccessToken(ctx context.Context, accessToken string) (*PublicDashboard, *dashboards.Dashboard, error)
	FindByAccessToken(ctx context.Context, accessToken string) (*PublicDashboard, error)
	FindByDashboardUid(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error)
	FindAnnotations(ctx context.Context, reqDTO AnnotationsQueryDTO, accessToken string) ([]AnnotationEvent, error)
	FindDashboard(ctx context.Context, orgId int64, dashboardUid string) (*dashboards.Dashboard, error)
	FindAll(ctx context.Context, u *user.SignedInUser, orgId int64) ([]PublicDashboardListResponse, error)
	Find(ctx context.Context, uid string) (*PublicDashboard, error)
	Create(ctx context.Context, u *user.SignedInUser, dto *SavePublicDashboardDTO) (*PublicDashboard, error)
	Update(ctx context.Context, u *user.SignedInUser, dto *SavePublicDashboardDTO) (*PublicDashboard, error)
	Delete(ctx context.Context, uid string) error
	DeleteByDashboard(ctx context.Context, dashboard *dashboards.Dashboard) error

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
}

//go:generate mockery --name Store --structname FakePublicDashboardStore --inpackage --filename public_dashboard_store_mock.go
type Store interface {
	Find(ctx context.Context, uid string) (*PublicDashboard, error)
	FindByAccessToken(ctx context.Context, accessToken string) (*PublicDashboard, error)
	FindByDashboardUid(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error)
	FindDashboard(ctx context.Context, orgId int64, dashboardUid string) (*dashboards.Dashboard, error)
	FindAll(ctx context.Context, orgId int64) ([]PublicDashboardListResponse, error)
	Create(ctx context.Context, cmd SavePublicDashboardCommand) (int64, error)
	Update(ctx context.Context, cmd SavePublicDashboardCommand) (int64, error)
	Delete(ctx context.Context, uid string) (int64, error)

	GetOrgIdByAccessToken(ctx context.Context, accessToken string) (int64, error)
	FindByDashboardFolder(ctx context.Context, dashboard *dashboards.Dashboard) ([]*PublicDashboard, error)
	ExistsEnabledByAccessToken(ctx context.Context, accessToken string) (bool, error)
	ExistsEnabledByDashboardUid(ctx context.Context, dashboardUid string) (bool, error)
	GetMetrics(ctx context.Context) (*Metrics, error)
}
