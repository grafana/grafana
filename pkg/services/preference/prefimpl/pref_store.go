package prefimpl

import (
	"context"

	models "github.com/grafana/grafana/pkg/services/preference"
)

type Store interface {
	Get(context.Context, *models.GetPreferencesQuery) (*models.Preferences, error)
	GetDefaults() *models.Preferences
	List(ctx context.Context, query *models.ListPreferencesQuery) ([]*models.Preferences, error)
	Set(context.Context, *models.SavePreferencesCommand) (*models.Preferences, error)
}
