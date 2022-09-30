package preftest

import (
	"context"

	pref "github.com/grafana/grafana/pkg/services/preference"
)

type FakePreferenceService struct {
	ExpectedPreference *pref.Preference
	ExpectedError      error
}

func NewPreferenceServiceFake() *FakePreferenceService {
	return &FakePreferenceService{}
}

func (f *FakePreferenceService) GetWithDefaults(ctx context.Context, query *pref.GetPreferenceWithDefaultsQuery) (*pref.Preference, error) {
	return f.ExpectedPreference, f.ExpectedError
}

func (f *FakePreferenceService) Get(ctx context.Context, query *pref.GetPreferenceQuery) (*pref.Preference, error) {
	return f.ExpectedPreference, f.ExpectedError
}

func (f *FakePreferenceService) Save(ctx context.Context, cmd *pref.SavePreferenceCommand) error {
	return f.ExpectedError
}

func (f *FakePreferenceService) GetDefaults() *pref.Preference {
	return f.ExpectedPreference
}

func (f *FakePreferenceService) Patch(ctx context.Context, cmd *pref.PatchPreferenceCommand) error {
	return f.ExpectedError
}

func (f *FakePreferenceService) DeleteByUser(context.Context, int64) error {
	return f.ExpectedError
}
