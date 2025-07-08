package app

import (
	"context"
	"fmt"
	"path"
	"strings"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"

	shorturlv0alpha1 "github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v0alpha1"
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
				Kind: shorturlv0alpha1.ShortURLKind(),
				Mutator: &simple.Mutator{
					MutateFunc: func(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
						// Cast the incoming object to ShortURL
						shortURL, ok := req.Object.(*shorturlv0alpha1.ShortURL)
						if !ok {
							klog.ErrorS(nil, "Failed to cast object to ShortURL", "type", fmt.Sprintf("%T", req.Object))
							return nil, fmt.Errorf("expected ShortURL object, got %T", req.Object)
						}

						// GenerateName is required for object creation
						if shortURL.ObjectMeta.GenerateName == "" {
							shortURL.ObjectMeta.GenerateName = "shorturl-"
						}

						// Set calculated fields in spec
						shortURL.Spec.ShortURL = fmt.Sprintf("%s/goto/%s?orgId=%d", strings.TrimSuffix(shortURLConfig.AppURL, "/"), shortURL.Name, shortURL.Namespace)
						return &app.MutatingResponse{
							UpdatedObject: shortURL,
						}, nil
					},
				},
				Validator: &simple.Validator{
					ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
						// Cast the incoming object to ShortURL for validation
						shortURL, ok := req.Object.(*shorturlv0alpha1.ShortURL)
						if !ok {
							return fmt.Errorf("expected ShortURL object, got %T", req.Object)
						}

						relPath := strings.TrimSpace(shortURL.Spec.Path)

						if path.IsAbs(relPath) {
							return shorturls.ErrShortURLAbsolutePath.Errorf("expected relative path: %s", relPath)
						}
						if strings.Contains(relPath, "../") {
							return shorturls.ErrShortURLInvalidPath.Errorf("path cannot contain '../': %s", relPath)
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
		Group:   shorturlv0alpha1.ShortURLKind().Group(),
		Version: shorturlv0alpha1.ShortURLKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {shorturlv0alpha1.ShortURLKind()},
	}
}
