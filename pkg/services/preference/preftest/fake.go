package preftest

import (
	"context"

	pref "github.com/grafana/grafana/pkg/services/preference"
)

type FakePreferenceService struct {
	ExpectedPreference *pref.Preferences
	ExpectedError      error
}

func NewPreferenceServiceFake() *FakePreferenceService {
	return &FakePreferenceService{}
}

func (f *FakePreferenceService) GetWithDefaults(ctx context.Context, query *pref.GetPreferenceWithDefaultsQuery) (*pref.Preferences, error) {
	return f.ExpectedPreference, f.ExpectedError
}

func (f *FakePreferenceService) Get(ctx context.Context, query *pref.GetPreferenceQuery) (*pref.Preferences, error) {
	return f.ExpectedPreference, f.ExpectedError
}

func (f *FakePreferenceService) Save(ctx context.Context, cmd *pref.SavePreferenceCommand) error {
	return f.ExpectedError
}

func (f *FakePreferenceService) GetDefaults() *pref.Preferences {
	return f.ExpectedPreference
}

type FakePreferenceStore struct {
	ExpectedPreference      *pref.Preferences
	ExpectedListPreferences []*pref.Preferences
	ExpectedError           error
}

func NewPreferenceStoreFake() *FakePreferenceStore {
	return &FakePreferenceStore{}
}

func (f *FakePreferenceStore) List(ctx context.Context, query *pref.ListPreferenceQuery) ([]*pref.Preferences, error) {
	return f.ExpectedListPreferences, f.ExpectedError
}

func (f *FakePreferenceStore) Get(ctx context.Context, query *pref.GetPreferenceQuery) (*pref.Preferences, error) {
	return f.ExpectedPreference, f.ExpectedError
}

func (f *FakePreferenceStore) Set(ctx context.Context, cmd *pref.SavePreferenceCommand) error {
	return f.ExpectedError
}

func (f *FakePreferenceStore) Upsert(ctx context.Context, cmd *pref.Preferences, exist bool) error {
	return f.ExpectedError
}
