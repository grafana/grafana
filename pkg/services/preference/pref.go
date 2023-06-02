package pref

import (
	"context"

	"github.com/grafana/grafana/pkg/kinds/preferences"
)

type Service interface {
	GetWithDefaults(context.Context, *GetPreferenceWithDefaultsQuery) (*Preference, error)
	Get(context.Context, *GetPreferenceQuery) (*Preference, error)
	Save(context.Context, *SavePreferenceCommand) error
	Patch(context.Context, *PatchPreferenceCommand) error
	GetDefaults() *Preference
	DeleteByUser(context.Context, int64) error

	// k8s exporter
	GetPreferences(ctx context.Context, orgId int64) ([]preferences.K8sResource, error)
}
