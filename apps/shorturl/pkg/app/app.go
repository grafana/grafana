package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	shorturlv1beta1 "github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// Local error definitions to avoid importing the main shorturls package
var (
	ErrShortURLAbsolutePath = fmt.Errorf("path should be relative")
	ErrShortURLInvalidPath  = fmt.Errorf("invalid short URL path")
)

func New(cfg app.Config) (app.App, error) {
	cfg.KubeConfig.APIPath = "apis"
	tmp, err := k8s.NewClientRegistry(cfg.KubeConfig, k8s.DefaultClientConfig()).
		ClientFor(shorturlv1beta1.ShortURLKind())
	if err != nil {
		return nil, fmt.Errorf("unable to create client")
	}
	client := shorturlv1beta1.NewShortURLClient(tmp)

	simpleConfig := simple.AppConfig{
		Name:       "shorturl",
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
				Kind: shorturlv1beta1.ShortURLKind(),
				Validator: &simple.Validator{
					ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
						// Cast the incoming object to ShortURL for validation
						shortURL, ok := req.Object.(*shorturlv1beta1.ShortURL)
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
						url, _, found := strings.Cut(req.URL.Path, "/apis/") // This will be settings.AppURL
						if !found {
							return fmt.Errorf("unable to parse request URL")
						}
						id := resource.Identifier{
							Namespace: req.ResourceIdentifier.Namespace,
							Name:      req.ResourceIdentifier.Name,
						}

						info, err := client.Get(ctx, id)
						if err != nil {
							return err
						}

						// Update lastSeenAt in the background
						func() { // TODO, this should be async, but keeping sync until we update tests
							info.Status.LastSeenAt = time.Now().UnixMilli()
							ctx, _, err := identity.WithProvisioningIdentity(context.Background(), req.ResourceIdentifier.Namespace)
							if err != nil {
								logging.FromContext(ctx).Warn("unable to create background identity", "err", err)
							} else {
								_, err = client.UpdateStatus(ctx, id, info.Status, resource.UpdateOptions{
									ResourceVersion: info.ResourceVersion,
								})
								if err != nil {
									logging.FromContext(ctx).Warn("unable to update status", "err", err)
								}
							}
						}()

						url = url + "/" + info.Spec.Path
						if req.URL.Query().Get("redirect") == "false" { // helpful for testing
							return json.NewEncoder(w).Encode(shorturlv1beta1.GetGoto{
								Url: url,
							})
						}
						w.Header().Add("Location", url)
						w.WriteHeader(http.StatusFound)
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
		Group:   shorturlv1beta1.ShortURLKind().Group(),
		Version: shorturlv1beta1.ShortURLKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {shorturlv1beta1.ShortURLKind()},
	}
}
