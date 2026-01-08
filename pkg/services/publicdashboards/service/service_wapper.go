package service

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
)

// PublicDashboardServiceWrapperImpl Define the Service Implementation. We're generating mock implementation
// automatically
type PublicDashboardServiceWrapperImpl struct {
	log   log.Logger
	store publicdashboards.Store
}

// Gives us compile time error if the service does not adhere to the contract of
// the interface
var _ publicdashboards.ServiceWrapper = (*PublicDashboardServiceWrapperImpl)(nil)

// ProvideServiceWrapper Factory for method used by wire to inject dependencies.
// builds the service, and api, and configures routes
func ProvideServiceWrapper(
	store publicdashboards.Store,
) *PublicDashboardServiceWrapperImpl {
	return &PublicDashboardServiceWrapperImpl{
		log:   log.New(LogPrefix),
		store: store,
	}
}

// FindByDashboardUid is a helper method to retrieve the public dashboard configuration for a given dashboard from the database
func (pd *PublicDashboardServiceWrapperImpl) FindByDashboardUid(ctx context.Context, orgId int64, dashboardUid string) (*PublicDashboard, error) {
	pubdash, err := pd.store.FindByDashboardUid(ctx, orgId, dashboardUid)
	if err != nil {
		return nil, ErrInternalServerError.Errorf("FindByDashboardUid: failed to find a public dashboard by orgId: %d and dashboardUid: %s: %w", orgId, dashboardUid, err)
	}

	if pubdash == nil {
		return nil, ErrPublicDashboardNotFound.Errorf("FindByDashboardUid: Public dashboard not found by orgId: %d and dashboardUid: %s", orgId, dashboardUid)
	}

	return pubdash, nil
}

func (pd *PublicDashboardServiceWrapperImpl) Delete(ctx context.Context, uid string) error {
	_, err := pd.store.Delete(ctx, uid)
	if err != nil {
		return ErrInternalServerError.Errorf("Delete: failed to delete a public dashboard by Uid: %s %w", uid, err)
	}

	return nil
}

func (pd *PublicDashboardServiceWrapperImpl) DeleteByDashboardUIDs(ctx context.Context, orgId int64, dashboardUIDs []string) error {
	err := pd.store.DeleteByDashboardUIDs(ctx, orgId, dashboardUIDs)
	if err != nil {
		return ErrInternalServerError.Errorf("DeleteByDashboardUIDs: failed to delete public dashboards by dashboard UIDs: %v %w", dashboardUIDs, err)
	}

	return nil
}
