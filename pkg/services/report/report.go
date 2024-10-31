package report

import (
	"context"

	reportmodels "github.com/grafana/grafana/pkg/services/report/models"
	"github.com/grafana/grafana/pkg/services/user"
)

type Service interface {
	GetReportsByOrg(ctx context.Context, orgID int64, user *user.SignedInUser) ([]*reportmodels.Report, error)
	GetDashboards(ctx context.Context, report *reportmodels.Report) ([]reportmodels.DashboardDTO, error)
	GetSettingsByOrg(ctx context.Context, orgId int64) (*reportmodels.Settings, error)
	CreateAndScheduleReport(ctx context.Context, cmd reportmodels.CreateOrUpdateReportDTO) (*reportmodels.Report, error)
	UpdateAndScheduleReport(ctx context.Context, cmd reportmodels.CreateOrUpdateReportDTO) error
	DeleteReport(ctx context.Context, reportID int64, orgID int64) error
	GetReportByReportIDAndOrgID(ctx context.Context, id int64, orgID int64) (*reportmodels.Report, error)
	SaveSettings(ctx context.Context, settings reportmodels.Settings) error
}
