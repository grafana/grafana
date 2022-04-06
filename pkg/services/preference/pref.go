package pref

import (
	"context"
)

type Service interface {
	GetWithDefaults(context.Context, *GetPreferenceWithDefaultsQuery) (*Preferences, error)
	Get(context.Context, *GetPreferenceQuery) (*Preferences, error)
	Save(context.Context, *SavePreferenceCommand) error
	Patch(ctx context.Context, cmd *PatchPreferenceCommand) error
	GetDefaults() *Preferences
}
