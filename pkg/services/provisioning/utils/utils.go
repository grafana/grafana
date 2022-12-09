package utils

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/org"
)

type DashboardStore interface {
	GetDashboard(context.Context, *models.GetDashboardQuery) error
}

func CheckOrgExists(ctx context.Context, orgService org.Service, orgID int64) error {
	query := org.GetOrgByIdQuery{ID: orgID}
	_, err := orgService.GetByID(ctx, &query)
	if err != nil {
		if errors.Is(err, models.ErrOrgNotFound) {
			return err
		}
		return fmt.Errorf("failed to check whether org. with the given ID exists: %w", err)
	}
	return nil
}
