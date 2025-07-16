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
	shorturlv0alpha1 "github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v0alpha1"
	"github.com/teris-io/shortid"
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
				Kind: shorturlv0alpha1.ShortURLKind(),
				Mutator: &simple.Mutator{
					MutateFunc: func(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
						// Skip validation for non-CREATE operations as specified in the manifest
						// TODO: Remove this after the SDK fixes this bug where validation is called for all mutating operations
						// ignoring what the manifest says
						if req.Action != resource.AdmissionActionCreate {
							// For non-CREATE operations, return the object as-is
							// Use OldObject if Object is nil (common in DELETE operations)
							objectToReturn := req.Object
							if objectToReturn == nil {
								objectToReturn = req.OldObject
							}
							return &app.MutatingResponse{
								UpdatedObject: objectToReturn,
							}, nil
						}

						// Cast the incoming object to ShortURL
						shortURL, ok := req.Object.(*shorturlv0alpha1.ShortURL)
						if !ok {
							klog.ErrorS(nil, "Failed to cast object to ShortURL", "type", fmt.Sprintf("%T", req.Object))
							return nil, fmt.Errorf("expected ShortURL object, got %T", req.Object)
						}

						if shortURL.ObjectMeta.Name == "" {
							uid, err := shortid.Generate()
							if err != nil {
								return nil, err
							}
							shortURL.ObjectMeta.Name = uid
						}

						// Use the same UID for both the object name and spec.uid
						shortURL.Spec.Uid = shortURL.ObjectMeta.Name

						// Set calculated shortURL field
						shortURL.Spec.ShortURL = fmt.Sprintf("%s/goto/%s?orgId=%s",
							strings.TrimSuffix(shortURLConfig.AppURL, "/"),
							shortURL.Spec.Uid,
							shortURL.Namespace)

						return &app.MutatingResponse{
							UpdatedObject: shortURL,
						}, nil
					},
				},
				Validator: &simple.Validator{
					ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
						// Skip validation for non-CREATE operations as specified in the manifest
						// TODO: Remove this after the SDK fixes this bug where validation is called for all mutating operations
						// ignoring what the manifest says
						if req.Action != resource.AdmissionActionCreate {
							return nil
						}

						// Cast the incoming object to ShortURL for validation
						shortURL, ok := req.Object.(*shorturlv0alpha1.ShortURL)
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
		Group:   shorturlv0alpha1.ShortURLKind().Group(),
		Version: shorturlv0alpha1.ShortURLKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {shorturlv0alpha1.ShortURLKind()},
	}
}
