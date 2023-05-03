package prefimpl

import (
	"context"

	pref "github.com/grafana/grafana/pkg/services/preference"
)

type store interface {
	Get(context.Context, *pref.Preference) (*pref.Preference, error)
	List(context.Context, *pref.Preference) ([]*pref.Preference, error)
	// Insert adds a new preference and returns its sequential ID
	Insert(context.Context, *pref.Preference) (int64, error)
	Update(context.Context, *pref.Preference) error
	DeleteByUser(context.Context, int64) error
}
