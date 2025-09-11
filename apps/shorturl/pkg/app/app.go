package app

import (
	"context"
	"encoding/json"
	"fmt"
	"path"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	shorturlv1alpha1 "github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1alpha1"
)

// Local error definitions to avoid importing the main shorturls package
var (
	ErrShortURLAbsolutePath = fmt.Errorf("path should be relative")
	ErrShortURLInvalidPath  = fmt.Errorf("invalid short URL path")
)

type ShortURLConfig struct {
	AppURL string
}

func New(cfg app.Config) (app.App, error) {
	// Extract the AppURL from the specific config
	shortURLConfig, ok := cfg.SpecificConfig.(*ShortURLConfig)
	if !ok || shortURLConfig == nil {
		return nil, fmt.Errorf("invalid or missing ShortURLConfig")
	}
	client, err := k8s.NewClientRegistry(cfg.KubeConfig, k8s.DefaultClientConfig()).ClientFor(shorturlv1alpha1.ShortURLKind())
	if err != nil {
		return nil, fmt.Errorf("unable to create client")
	}

	simpleConfig := simple.AppConfig{
		Name:       "shorturl",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				klog.ErrorS(err, "Informer processing error")
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: shorturlv1alpha1.ShortURLKind(),
				Validator: &simple.Validator{
					ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
						// Cast the incoming object to ShortURL for validation
						shortURL, ok := req.Object.(*shorturlv1alpha1.ShortURL)
						if !ok {
							return fmt.Errorf("expected ShortURL object, got %T", req.Object)
						}

						relPath := strings.TrimSpace(shortURL.Spec.Path)
						if path.IsAbs(relPath) {
							return fmt.Errorf("%w: %s", ErrShortURLAbsolutePath, relPath)
						}
						if strings.Contains(relPath, "../") {
							return fmt.Errorf("%w: %s", ErrShortURLInvalidPath, relPath)
						}
						return nil
					},
				},
				CustomRoutes: simple.AppCustomRouteHandlers{
					simple.AppCustomRoute{
						Method: "GET",
						Path:   "goto",
					}: func(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
						info := &shorturlv1alpha1.ShortURL{}
						if err := client.GetInto(ctx, resource.Identifier{
							Namespace: req.ResourceIdentifier.Namespace,
							Name:      req.ResourceIdentifier.Name,
						}, info); err != nil {
							return err
						}

						resp := shorturlv1alpha1.GetGoto{
							Url: "????" + info.Spec.Path,
						}
						return json.NewEncoder(w).Encode(resp)
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
		Group:   shorturlv1alpha1.ShortURLKind().Group(),
		Version: shorturlv1alpha1.ShortURLKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {shorturlv1alpha1.ShortURLKind()},
	}
}
