package pref

import (
	"context"
)

type Service interface {
	GetPreferenceWithDefaults(context.Context, *models.GetPreferenceWithDefaultsQuery) (*models.Preference, error)
	GetPreference(context.Context, *models.GetPreferenceQuery) (*models.Preference, error)
	SavePreference(context.Context, *models.SavePreferenceCommand) (*models.Preference, error)
}
