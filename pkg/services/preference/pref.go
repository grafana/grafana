package pref

import (
	"context"
)

type Service interface {
	GetWithDefaults(context.Context, *GetPreferenceWithDefaultsQuery) (*Preference, error)
	Get(context.Context, *GetPreferenceQuery) (*Preference, error)
	Save(context.Context, *SavePreferenceCommand) error
	Patch(ctx context.Context, cmd *PatchPreferenceCommand) error
	GetDefaults() *Preference
}
