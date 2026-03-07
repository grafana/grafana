package preftest

import (
	"context"

	pref "github.com/grafana/grafana/pkg/services/preference"
)

type FakeThemeValidator struct{}

func NewFakeThemeValidator() *FakeThemeValidator {
	return &FakeThemeValidator{}
}

// IsValidThemeID accepts all built-in themes and rejects everything else.
func (f *FakeThemeValidator) IsValidThemeID(_ context.Context, _ int64, id string) bool {
	return pref.IsValidThemeID(id)
}

// GetThemeByID returns built-in theme DTOs.
func (f *FakeThemeValidator) GetThemeByID(_ context.Context, _ int64, id string) *pref.ThemeDTO {
	return pref.GetThemeByID(id)
}
