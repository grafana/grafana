package report

import (
	"context"

	reportmodels "github.com/grafana/grafana/pkg/services/report/models"
	"github.com/grafana/grafana/pkg/services/user"
)

// NoopReportService is an empty implementation of the Reporting service.
type NoopReportService struct{}

var _ Service = (*NoopReportService)(nil)

func ProvideNoopReportService() *NoopReportService {
	return &NoopReportService{}
}

func (NoopReportService) GetReportsByOrg(ctx context.Context, orgID int64, user *user.SignedInUser) ([]*reportmodels.Report, error) {
	return make([]*reportmodels.Report, 0), nil
}

func (NoopReportService) GetDashboards(ctx context.Context, report *reportmodels.Report) ([]reportmodels.DashboardDTO, error) {
	return make([]reportmodels.DashboardDTO, 0), nil
}

func (NoopReportService) GetSettingsByOrg(ctx context.Context, orgId int64) (*reportmodels.Settings, error) {
	return new(reportmodels.Settings), nil
}

func (NoopReportService) CreateAndScheduleReport(ctx context.Context, cmd reportmodels.CreateOrUpdateReportDTO) (*reportmodels.Report, error) {
	return new(reportmodels.Report), nil
}

func (NoopReportService) UpdateAndScheduleReport(ctx context.Context, cmd reportmodels.CreateOrUpdateReportDTO) error {
	return nil
}

func (NoopReportService) DeleteReport(ctx context.Context, reportID int64, orgID int64) error {
	return nil
}

func (NoopReportService) GetReportByReportIDAndOrgID(ctx context.Context, id int64, orgID int64) (*reportmodels.Report, error) {
	return new(reportmodels.Report), nil
}

func (NoopReportService) SaveSettings(ctx context.Context, settings reportmodels.Settings) error {
	return nil
}
