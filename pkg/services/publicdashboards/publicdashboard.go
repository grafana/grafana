package publicdashboards

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/user"
)

// These are the api contracts. The API should match the underlying service and store

//go:generate mockery --name Service --structname FakePublicDashboardService --inpackage --filename public_dashboard_service_mock.go
type Service interface {
	BuildAnonymousUser(ctx context.Context, dashboard *models.Dashboard) (*user.SignedInUser, error)
	GetPublicDashboard(ctx context.Context, accessToken string) (*PublicDashboard, *models.Dashboard, error)
	GetDashboard(ctx context.Context, dashboardUid string) (*models.Dashboard, error)
	GetPublicDashboardConfig(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error)
	SavePublicDashboardConfig(ctx context.Context, u *user.SignedInUser, dto *SavePublicDashboardConfigDTO) (*PublicDashboard, error)
	GetQueryDataResponse(ctx context.Context, skipCache bool, reqDTO *PublicDashboardQueryDTO, panelId int64, accessToken string) (*backend.QueryDataResponse, error)
	PublicDashboardEnabled(ctx context.Context, dashboardUid string) (bool, error)
	AccessTokenExists(ctx context.Context, accessToken string) (bool, error)
}

//go:generate mockery --name Store --structname FakePublicDashboardStore --inpackage --filename public_dashboard_store_mock.go
type Store interface {
	GetPublicDashboard(ctx context.Context, accessToken string) (*PublicDashboard, *models.Dashboard, error)
	GetDashboard(ctx context.Context, dashboardUid string) (*models.Dashboard, error)
	GetPublicDashboardConfig(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error)
	GetPublicDashboardByUid(ctx context.Context, uid string) (*PublicDashboard, error)
	GenerateNewPublicDashboardUid(ctx context.Context) (string, error)
	SavePublicDashboardConfig(ctx context.Context, cmd SavePublicDashboardConfigCommand) error
	UpdatePublicDashboardConfig(ctx context.Context, cmd SavePublicDashboardConfigCommand) error
	PublicDashboardEnabled(ctx context.Context, dashboardUid string) (bool, error)
	AccessTokenExists(ctx context.Context, accessToken string) (bool, error)
}
