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
	GetAnnotations(ctx context.Context, reqDTO AnnotationsQueryDTO, accessToken string) ([]AnnotationEvent, error)
	GetDashboard(ctx context.Context, dashboardUid string) (*models.Dashboard, error)
	GetMetricRequest(ctx context.Context, dashboard *models.Dashboard, publicDashboard *PublicDashboard, panelId int64, reqDTO PublicDashboardQueryDTO) (dtos.MetricRequest, error)
	GetPublicDashboard(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error)
	GetPublicDashboardAndDashboard(ctx context.Context, accessToken string) (*PublicDashboard, *models.Dashboard, error)
	GetPublicDashboardOrgId(ctx context.Context, accessToken string) (int64, error)
	GetQueryDataResponse(ctx context.Context, skipCache bool, reqDTO PublicDashboardQueryDTO, panelId int64, accessToken string) (*backend.QueryDataResponse, error)
	ListPublicDashboards(ctx context.Context, u *user.SignedInUser, orgId int64) ([]PublicDashboardListResponse, error)
	PublicDashboardEnabledExistsByAccessToken(ctx context.Context, accessToken string) (bool, error)
	PublicDashboardIsEnabled(ctx context.Context, dashboardUid string) (bool, error)
	SavePublicDashboard(ctx context.Context, u *user.SignedInUser, dto *SavePublicDashboardConfigDTO) (*PublicDashboard, error)
}

//go:generate mockery --name Store --structname FakePublicDashboardStore --inpackage --filename public_dashboard_store_mock.go
type Store interface {
	GenerateNewPublicDashboardUid(ctx context.Context) (string, error)
	GenerateNewPublicDashboardAccessToken(ctx context.Context) (string, error)
	GetDashboard(ctx context.Context, dashboardUid string) (*models.Dashboard, error)
	GetPublicDashboard(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error)
	GetPublicDashboardAndDashboard(ctx context.Context, accessToken string) (*PublicDashboard, *models.Dashboard, error)
	GetPublicDashboardByUid(ctx context.Context, uid string) (*PublicDashboard, error)
	GetPublicDashboardOrgId(ctx context.Context, accessToken string) (int64, error)
	ListPublicDashboards(ctx context.Context, orgId int64) ([]PublicDashboardListResponse, error)
	PublicDashboardEnabledExistsByAccessToken(ctx context.Context, accessToken string) (bool, error)
	PublicDashboardEnabledExistsByDashboardUid(ctx context.Context, dashboardUid string) (bool, error)
	SavePublicDashboard(ctx context.Context, cmd SavePublicDashboardConfigCommand) error
	UpdatePublicDashboard(ctx context.Context, cmd SavePublicDashboardConfigCommand) error
}
