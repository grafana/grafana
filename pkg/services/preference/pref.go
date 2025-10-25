package pref

import (
	"context"
)

type Service interface {
	GetWithDefaults(context.Context, *GetPreferenceWithDefaultsQuery) (*Preference, error)
	Get(context.Context, *GetPreferenceQuery) (*Preference, error)
	Save(context.Context, *SavePreferenceCommand) error
	Patch(context.Context, *PatchPreferenceCommand) error
	Find(context.Context, *FindPreferenceQuery) ([]*Preference, error)
	GetDefaults() *Preference
	Delete(context.Context, *DeleteCommand) error
}
