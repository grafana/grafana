package app

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	playlistv0alpha1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	playlistv1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v1"
	"github.com/grafana/grafana/apps/playlist/pkg/reconcilers"
)

type PlaylistConfig struct {
	EnableReconcilers bool
}

func getPatchClient(restConfig rest.Config, playlistKind resource.Kind) (operator.PatchClient, error) {
	clientGenerator := k8s.NewClientRegistry(restConfig, k8s.ClientConfig{})
	return clientGenerator.ClientFor(playlistKind)
}

func New(cfg app.Config) (app.App, error) {
	var (
		playlistReconciler operator.Reconciler
		err                error
	)

	playlistConfig, ok := cfg.SpecificConfig.(*PlaylistConfig)
	if ok && playlistConfig.EnableReconcilers {
		patchClient, err := getPatchClient(cfg.KubeConfig, playlistv0alpha1.PlaylistKind())
		if err != nil {
			klog.ErrorS(err, "Error getting patch client for use with opinionated reconciler")
			return nil, err
		}

		playlistReconciler, err = reconcilers.NewPlaylistReconciler(patchClient)
		if err != nil {
			klog.ErrorS(err, "Error creating playlist reconciler")
			return nil, err
		}
	}

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
				Kind:       playlistv0alpha1.PlaylistKind(),
				Reconciler: playlistReconciler,
				Mutator:    playlistMutator,
				Validator:  playlistValidator,
			},
			{
				Kind:       playlistv1.PlaylistKind(),
				Reconciler: playlistReconciler,
				Mutator:    playlistMutator,
				Validator:  playlistValidator,
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
