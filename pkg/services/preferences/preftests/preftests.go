package preftests

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
	ExpectedPreferences     *models.Preferences
	ExpectedListPreferences []*models.Preferences
	ExpectedError           error
}

func NewPreferenceStoreFake() *FakePreferencesStore {
	return &FakePreferencesStore{}
}

func (f *FakePreferencesStore) List(ctx context.Context, query *models.ListPreferencesQuery) ([]*models.Preferences, error) {
	return f.ExpectedListPreferences, f.ExpectedError
}

func (f *FakePreferencesStore) Get(ctx context.Context, query *models.GetPreferencesQuery) (*models.Preferences, error) {
	return f.ExpectedPreferences, f.ExpectedError
}

func (f *FakePreferencesService) GetDefault() *models.Preferences {
	return f.ExpectedPreferences
}

func (f *FakePreferencesStore) Set(ctx context.Context, cmd *models.SavePreferencesCommand) error {
	return f.ExpectedError
}
