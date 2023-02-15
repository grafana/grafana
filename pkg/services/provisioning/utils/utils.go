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

func CheckOrgExists(ctx context.Context, orgService org.Service, orgID int64) error {
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
