package pref

import (
	"context"
)

type Service interface {
	GetPreferenceWithDefaults(context.Context, *GetPreferenceWithDefaultsQuery) (*Preference, error)
	GetPreference(context.Context, *GetPreferenceQuery) (*Preference, error)
	SavePreference(context.Context, *SavePreferenceCommand) (*Preference, error)
}
