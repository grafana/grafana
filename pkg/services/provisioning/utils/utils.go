package utils

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
)

type OrgStore interface {
	GetOrgById(context.Context, *models.GetOrgByIdQuery) error
}

type DashboardStore interface {
	GetDashboard(context.Context, *models.GetDashboardQuery) error
}

func CheckOrgExists(ctx context.Context, store OrgStore, orgID int64) error {
	query := models.GetOrgByIdQuery{Id: orgID}
	if err := store.GetOrgById(ctx, &query); err != nil {
		if errors.Is(err, models.ErrOrgNotFound) {
			return err
		}
		return fmt.Errorf("failed to check whether org. with the given ID exists: %w", err)
	}
	return nil
}
