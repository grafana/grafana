package preftest

import "context"

type FakePreferenceService struct {
	ExpectedPreference *models.Preference
	ExpectedError      error
}

func NewPreferenceServiceFake() *FakePreferenceService {
	return &FakePreferenceService{}
}

func (f *FakePreferenceService) GetPreferencesWithDefaults(ctx context.Context, query *models.GetPreferencesWithDefaultsQuery) (*models.Preferences, error) {
	return f.ExpectedPreference, f.ExpectedError
}

func (f *FakePreferenceService) GetPreferences(ctx context.Context, query *models.GetPreferencesQuery) (*models.Preferences, error) {
	return f.ExpectedPreference, f.ExpectedError
}

func (f *FakePreferenceService) SavePreferences(ctx context.Context, cmd *models.SavePreferencesCommand) (*models.Preferences, error) {
	return f.ExpectedPreference, f.ExpectedError
}

type FakePreferenceStore struct {
	ExpectedPreference      *models.Preference
	ExpectedListPreferences []*models.Preference
	ExpectedError           error
}

func NewPreferenceStoreFake() *FakePreferenceStore {
	return &FakePreferenceStore{}
}

func (f *FakePreferenceStore) List(ctx context.Context, query *models.ListPreferencesQuery) ([]*models.Preferences, error) {
	return f.ExpectedListPreferences, f.ExpectedError
}

func (f *FakePreferenceStore) Get(ctx context.Context, query *models.GetPreferencesQuery) (*models.Preferences, error) {
	return f.ExpectedPreference, f.ExpectedError
}

func (f *FakePreferenceStore) GetDefaults() *models.Preferences {
	return f.ExpectedPreference
}

func (f *FakePreferenceStore) Set(ctx context.Context, cmd *models.SavePreferencesCommand) (*models.Preferences, error) {
	return f.ExpectedPreference, f.ExpectedError
}
