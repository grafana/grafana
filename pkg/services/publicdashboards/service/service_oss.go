package service

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/setting"
)

// PublicDashboardOSSServiceImpl Define the Service Implementation. We're generating mock implementation
// automatically
type PublicDashboardOSSServiceImpl struct {
	log   log.Logger
	cfg   *setting.Cfg
	store publicdashboards.Store
}

// Gives us compile time error if the service does not adhere to the contract of
// the interface
var _ publicdashboards.WrappedService = (*PublicDashboardOSSServiceImpl)(nil)

// ProvideOSSService Factory for method used by wire to inject dependencies.
// builds the service, and api, and configures routes
func ProvideOSSService(
	cfg *setting.Cfg,
	store publicdashboards.Store,
) *PublicDashboardOSSServiceImpl {
	return &PublicDashboardOSSServiceImpl{
		log:   log.New(LogPrefix),
		cfg:   cfg,
		store: store,
	}
}

// FindByDashboardUid is a helper method to retrieve the public dashboard configuration for a given dashboard from the database
func (pd *PublicDashboardOSSServiceImpl) FindByDashboardUid(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error) {
	pubdash, err := pd.store.FindByDashboardUid(ctx, orgId, dashboardUid)
	if err != nil {
		return nil, ErrInternalServerError.Errorf("FindByDashboardUid: failed to find a public dashboard by orgId: %d and dashboardUid: %s: %w", orgId, dashboardUid, err)
	}

	if pubdash == nil {
		return nil, ErrPublicDashboardNotFound.Errorf("FindByDashboardUid: Public dashboard not found by orgId: %d and dashboardUid: %s", orgId, dashboardUid)
	}

	return pubdash, nil
}
