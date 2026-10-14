package app

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	playlistv0alpha1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	playlistv1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v1"
)

type PlaylistConfig struct{}

func New(cfg app.Config) (app.App, error) {
	// shared for all versions
	playlistMutator := &simple.Mutator{
		MutateFunc: func(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
			return &app.MutatingResponse{
				UpdatedObject: req.Object,
			}, nil
		},
	}

	playlistValidator := &simple.Validator{
		ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
			return nil
		},
	}

	simpleConfig := simple.AppConfig{
		Name:       "playlist",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			InformerOptions: operator.InformerOptions{
				ErrorHandler: func(ctx context.Context, err error) {
					klog.ErrorS(err, "Informer processing error")
				},
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind:      playlistv0alpha1.PlaylistKind(),
				Mutator:   playlistMutator,
				Validator: playlistValidator,
			},
			{
				Kind:      playlistv1.PlaylistKind(),
				Mutator:   playlistMutator,
				Validator: playlistValidator,
			},
		},
		// Conversion for kinds is defined for all versions of a kind at once.
		// This interface may change in the future, see https://github.com/grafana/grafana-app-sdk/issues/617
		Converters: map[schema.GroupKind]simple.Converter{
			{
				Group: cfg.ManifestData.Group,
				Kind:  playlistv0alpha1.PlaylistKind().Kind(),
			}: NewExampleConverter(),
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

func GetKinds() map[schema.GroupVersion][]resource.Kind {
	gvV0alpha1 := schema.GroupVersion{
		Group:   playlistv0alpha1.PlaylistKind().Group(),
		Version: playlistv0alpha1.PlaylistKind().Version(),
	}
	gvV1 := schema.GroupVersion{
		Group:   playlistv1.PlaylistKind().Group(),
		Version: playlistv1.PlaylistKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gvV0alpha1: {playlistv0alpha1.PlaylistKind()},
		gvV1:       {playlistv1.PlaylistKind()},
	}
}
