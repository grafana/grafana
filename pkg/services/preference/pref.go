package pref

import (
	"context"
)

type Service interface {
	GetWithDefaults(context.Context, *GetPreferenceWithDefaultsQuery) (*Preference, error)
	Get(context.Context, *GetPreferenceQuery) (*Preference, error)
	Save(context.Context, *SavePreferenceCommand) error
	Patch(context.Context, *PatchPreferenceCommand) error
	GetDefaults() *Preference
	DeleteByUser(context.Context, int64) error
}
