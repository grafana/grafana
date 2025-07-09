package app

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"
	"k8s.io/klog/v2"
	"knative.dev/pkg/logging"

	playlistv0alpha1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
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
				CustomRoutes: map[simple.AppCustomRoute]simple.AppCustomRouteHandler{
					{
						Method: simple.AppCustomRouteMethodGet,
						Path:   "example",
					}: func(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
						logging.FromContext(ctx).Info("called example subresource", "resource", request.ResourceIdentifier.Name, "namespace", request.ResourceIdentifier.Namespace)
						writer.WriteHeader(http.StatusOK)
						return json.NewEncoder(writer).Encode(playlistv0alpha1.GetExample{
							Status: "ok",
						})
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
