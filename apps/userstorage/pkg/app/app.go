package app

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/userstorage/pkg/apis/userstorage/v0alpha1"
)

// New builds the user storage app. It has no admission of its own: access,
// including the name a new object may have, is decided by the name, in the
// router.
func New(cfg app.Config) (app.App, error) {
	a, err := simple.NewApp(simple.AppConfig{
		Name:       "userstorage",
		KubeConfig: cfg.KubeConfig,
		ManagedKinds: []simple.AppManagedKind{{
			Kind: v0alpha1.UserStorageKind(),
		}},
	})
	if err != nil {
		return nil, err
	}
	if err := a.ValidateManifest(cfg.ManifestData); err != nil {
		return nil, err
	}
	return a, nil
}
