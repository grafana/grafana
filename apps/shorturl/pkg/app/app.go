package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
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

// Config carries the app-specific configuration for the shorturl app.
type Config struct {
	// AppURL is Grafana's configured root URL (root_url), including any subpath
	// configured via serve_from_sub_path. It is used to build absolute redirect
	// URLs for the goto subresource so the redirect preserves the subpath.
	AppURL string
}

func New(cfg app.Config) (app.App, error) {
	cfg.KubeConfig.APIPath = "apis"
	tmp, err := k8s.NewClientRegistry(cfg.KubeConfig, k8s.DefaultClientConfig()).
		ClientFor(shorturlv1beta1.ShortURLKind())
	if err != nil {
		return nil, fmt.Errorf("unable to create client")
	}
	client := shorturlv1beta1.NewShortURLClient(tmp)

	// Grafana's configured root URL. When the app runs in-process this is the
	// authoritative base for redirects; it includes the subpath. We derive the
	// base from the request path only as a fallback (e.g. standalone deployments
	// where SpecificConfig is not provided).
	var configuredAppURL string
	if specificConfig, ok := cfg.SpecificConfig.(*Config); ok && specificConfig != nil {
		configuredAppURL = strings.TrimSuffix(specificConfig.AppURL, "/")
	}

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

						return validateRelativePath(shortURL.Spec.Path)
					},
				},
				CustomRoutes: simple.AppCustomRouteHandlers{
					simple.AppCustomRoute{
						Method: "GET",
						Path:   "goto",
					}: func(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
						appURL, err := resolveAppURL(configuredAppURL, req.URL.Path)
						if err != nil {
							return err
						}
						id := resource.Identifier{
							Namespace: req.ResourceIdentifier.Namespace,
							Name:      req.ResourceIdentifier.Name,
						}

						info, err := client.Get(ctx, id)
						if err != nil {
							return err
						}

						// Safety net: validate the stored path before redirecting
						if err := validateRelativePath(info.Spec.Path); err != nil {
							return fmt.Errorf("stored short URL has invalid path: %w", err)
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

						redirectURL := appURL + "/" + info.Spec.Path
						if req.URL.Query().Get("redirect") == "false" { // helpful for testing
							return json.NewEncoder(w).Encode(shorturlv1beta1.GetGotoResponse{
								Url: redirectURL,
							})
						}
						w.Header().Add("Location", redirectURL)
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

// resolveAppURL returns the base URL used to build short URL redirects.
//
// It prefers Grafana's configured root URL (which includes any subpath from
// serve_from_sub_path) so the redirect preserves the subpath. The request path
// is only a fallback for deployments where the configured URL is unavailable:
// for the in-process loopback call the path is "/apis/..." with the subpath
// already stripped, so relying on it there would drop the subpath from the
// redirect Location.
func resolveAppURL(configuredAppURL, requestPath string) (string, error) {
	if configuredAppURL != "" {
		return configuredAppURL, nil
	}
	base, _, found := strings.Cut(requestPath, "/apis/")
	if !found {
		return "", fmt.Errorf("unable to parse request URL")
	}
	return base, nil
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
