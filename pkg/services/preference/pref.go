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
	Delete(ctx context.Context, orgId, userId, teamId int64) error
}
