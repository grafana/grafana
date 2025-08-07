package app

import (
	"context"
	"fmt"
	"path"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana-app-sdk/app"
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
