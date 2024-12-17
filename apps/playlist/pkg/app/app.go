package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"

	playlistv0alpha1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	"github.com/grafana/grafana/apps/playlist/pkg/watchers"
)

type PlaylistConfig struct {
	EnableReconcilers bool
}

func New(cfg app.Config) (app.App, error) {
	var (
		playlistReconciler operator.Reconciler
		err                error
	)

	playlistConfig, ok := cfg.SpecificConfig.(*PlaylistConfig)
	if ok && playlistConfig.EnableReconcilers {
		playlistReconciler = watchers.NewPlaylistReconciler()
	}

	simpleConfig := simple.AppConfig{
		Name:       "playlist",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				klog.ErrorS(err, "Informer processing error")
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind:       playlistv0alpha1.PlaylistKind(),
				Reconciler: playlistReconciler,
				Mutator: &simple.Mutator{
					MutateFunc: func(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
						// modify req.Object if needed
						return &app.MutatingResponse{
							UpdatedObject: req.Object,
						}, nil
					},
				},
				Validator: &simple.Validator{
					ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
						// do something here if needed
						return nil
					},
				},
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

func GetKinds() map[schema.GroupVersion][]resource.Kind {
	gv := schema.GroupVersion{
		Group:   playlistv0alpha1.PlaylistKind().Group(),
		Version: playlistv0alpha1.PlaylistKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {playlistv0alpha1.PlaylistKind()},
	}
}
