package utils

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
)

type DashboardStore interface {
	GetDashboard(context.Context, *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error)
}

// Throw an error if the org does not exist
type OrgExists = func(ctx context.Context, orgID int64) error

// Use the org service to check if an org exists
func NewOrgExistsChecker(orgService org.Service) OrgExists {
	return func(ctx context.Context, orgID int64) error {
		query := org.GetOrgByIDQuery{ID: orgID}
		_, err := orgService.GetByID(ctx, &query)
		if err != nil {
			if errors.Is(err, org.ErrOrgNotFound) {
				return err
			}
			return fmt.Errorf("failed to check whether org. with the given ID exists: %w", err)
		}
		return nil
	}
}
