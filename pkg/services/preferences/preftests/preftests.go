package preftests

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type FakePreferencesManager struct {
	ExpectedPreferences *models.Preferences
	ExpectedError       error
}

func NewPreferenceManagerFake() *FakePreferencesManager {
	return &FakePreferencesManager{}
}

func (f *FakePreferencesManager) GetPreferencesWithDefaults(ctx context.Context, query *models.GetPreferencesWithDefaultsQuery) (*models.Preferences, error) {
	return f.ExpectedPreferences, f.ExpectedError
}

func (f *FakePreferencesManager) GetPreferences(ctx context.Context, query *models.GetPreferencesQuery) (*models.Preferences, error) {
	return f.ExpectedPreferences, f.ExpectedError
}

func (f *FakePreferencesManager) SavePreferences(ctx context.Context, cmd *models.SavePreferencesCommand) error {
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

func (f *FakePreferencesStore) GetDefaults() *models.Preferences {
	return f.ExpectedPreferences
}

func (f *FakePreferencesStore) Set(ctx context.Context, cmd *models.SavePreferencesCommand) error {
	return f.ExpectedError
}
