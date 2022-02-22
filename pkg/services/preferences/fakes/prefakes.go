package prefakes

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type FakePreferencesService struct {
	ExpectedPreferences *models.Preferences
	ExpectedError       error
}

func NewPreferenceServiceFake() *FakePreferencesService {
	return &FakePreferencesService{}
}

func (f *FakePreferencesService) GetPreferencesWithDefaults(ctx context.Context, query *models.GetPreferencesWithDefaultsQuery) (*models.Preferences, error) {
	return f.ExpectedPreferences, f.ExpectedError
}

func (f *FakePreferencesService) GetPreferences(ctx context.Context, query *models.GetPreferencesQuery) (*models.Preferences, error) {
	return f.ExpectedPreferences, f.ExpectedError
}

func (f *FakePreferencesService) SavePreferences(ctx context.Context, cmd *models.SavePreferencesCommand) error {
	return f.ExpectedError
}

type FakePreferencesStore struct {
	ExpectedPreferences *models.Preferences
	ExpectedError       error
}

func NewPreferenceStoreFake() *FakePreferencesStore {
	return &FakePreferencesStore{}
}

func (f *FakePreferencesStore) GetPreferencesWithDefaults(ctx context.Context, query *models.GetPreferencesWithDefaultsQuery) (*models.Preferences, error) {
	return f.ExpectedPreferences, f.ExpectedError
}

func (f *FakePreferencesStore) GetPreferences(ctx context.Context, query *models.GetPreferencesQuery) (*models.Preferences, error) {
	return f.ExpectedPreferences, f.ExpectedError
}

func (f *FakePreferencesStore) SavePreferences(ctx context.Context, cmd *models.SavePreferencesCommand) error {
	return f.ExpectedError
}
