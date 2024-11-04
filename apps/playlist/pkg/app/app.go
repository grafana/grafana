package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"

	playlistv0alpha1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	"github.com/grafana/grafana/apps/playlist/pkg/watchers"
)

type PlaylistConfig struct {
	EnableWatchers bool
}

func New(cfg app.Config) (app.App, error) {
	var (
		playlistWatcher operator.ResourceWatcher
		err             error
	)

	playlistConfig, ok := cfg.SpecificConfig.(*PlaylistConfig)
	if ok && playlistConfig.EnableWatchers {
		playlistWatcher, err = watchers.NewPlaylistWatcher()
		if err != nil {
			return nil, fmt.Errorf("unable to create PlaylistWatcher: %w", err)
		}
	}

	simpleConfig := simple.AppConfig{
		Name:       "playlist",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				logging.DefaultLogger.With("error", err).Error("Informer processing error")
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind:    playlistv0alpha1.PlaylistKind(),
				Watcher: playlistWatcher,
			},
		},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	err = a.ValidateManifest(cfg.ManifestData)
	if err != nil {
		return nil, err
	}

	return a, nil
}

func GetKinds() map[schema.GroupVersion]resource.Kind {
	gv := schema.GroupVersion{
		Group:   playlistv0alpha1.PlaylistKind().Group(),
		Version: playlistv0alpha1.PlaylistKind().Version(),
	}
	return map[schema.GroupVersion]resource.Kind{
		gv: playlistv0alpha1.PlaylistKind(),
	}
}
