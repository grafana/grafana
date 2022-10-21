package publicdashboards

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/user"
)

// These are the api contracts. The API should match the underlying service and store

//go:generate mockery --name Service --structname FakePublicDashboardService --inpackage --filename public_dashboard_service_mock.go
type Service interface {
	PublicDashboardEnabledExistsByAccessToken(ctx context.Context, accessToken string) (bool, error)
	GetAnnotations(ctx context.Context, reqDTO AnnotationsQueryDTO, accessToken string) ([]AnnotationEvent, error)
	GetDashboard(ctx context.Context, dashboardUid string) (*models.Dashboard, error)
	GetMetricRequest(ctx context.Context, dashboard *models.Dashboard, publicDashboard *PublicDashboard, panelId int64, reqDTO PublicDashboardQueryDTO) (dtos.MetricRequest, error)
	GetPublicDashboard(ctx context.Context, accessToken string) (*PublicDashboard, *models.Dashboard, error)
	GetPublicDashboardConfig(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error)
	GetPublicDashboardOrgId(ctx context.Context, accessToken string) (int64, error)
	GetQueryDataResponse(ctx context.Context, skipCache bool, reqDTO PublicDashboardQueryDTO, panelId int64, accessToken string) (*backend.QueryDataResponse, error)
	ListPublicDashboards(ctx context.Context, u *user.SignedInUser, orgId int64) ([]PublicDashboardListResponse, error)
	PublicDashboardEnabled(ctx context.Context, dashboardUid string) (bool, error)
	SavePublicDashboardConfig(ctx context.Context, u *user.SignedInUser, dto *SavePublicDashboardConfigDTO) (*PublicDashboard, error)
}

//go:generate mockery --name Store --structname FakePublicDashboardStore --inpackage --filename public_dashboard_store_mock.go
type Store interface {
	PublicDashboardEnabledExistsByAccessToken(ctx context.Context, accessToken string) (bool, error)
	PublicDashboardEnabledExistsByDashboardUid(ctx context.Context, dashboardUid string) (bool, error)
	GenerateNewPublicDashboardUid(ctx context.Context) (string, error)
	GetDashboard(ctx context.Context, dashboardUid string) (*models.Dashboard, error)
	GenerateNewPublicDashboardAccessToken(ctx context.Context) (string, error)
	GetPublicDashboard(ctx context.Context, accessToken string) (*PublicDashboard, *models.Dashboard, error)
	GetPublicDashboardByUid(ctx context.Context, uid string) (*PublicDashboard, error)
	GetPublicDashboardConfig(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error)
	GetPublicDashboardOrgId(ctx context.Context, accessToken string) (int64, error)
	ListPublicDashboards(ctx context.Context, orgId int64) ([]PublicDashboardListResponse, error)
	SavePublicDashboardConfig(ctx context.Context, cmd SavePublicDashboardConfigCommand) error
	UpdatePublicDashboardConfig(ctx context.Context, cmd SavePublicDashboardConfigCommand) error
}
