package utils

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func CheckOrgExists(ctx context.Context, orgID int64) error {
	query := models.GetOrgByIdQuery{Id: orgID}
	if err := bus.Dispatch(ctx, &query); err != nil {
		if errors.Is(err, models.ErrOrgNotFound) {
			return err
		}
		return fmt.Errorf("failed to check whether org. with the given ID exists: %w", err)
	}
	return nil
}
