package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
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

// validateRelativePath checks that a short URL path is a safe relative path
// that will not redirect to an external domain.
func validateRelativePath(rawPath string) error {
	p := strings.TrimSpace(rawPath)

	// IMPORTANT: This logic is duplicated in pkg/services/shorturls/models.go — keep both in sync.
	// Reject path traversal (forward and backslash variants)
	if strings.Contains(p, "../") || strings.Contains(p, `..\`) {
		return fmt.Errorf("%w: %s", ErrShortURLInvalidPath, p)
	}

	// Reject protocol-relative URLs (//evil.com) before the general absolute path check
	if strings.HasPrefix(p, "//") {
		return fmt.Errorf("%w: %s", ErrShortURLInvalidPath, p)
	}

	// Reject backslash-based paths that browsers may interpret as URLs
	if strings.HasPrefix(p, `\`) {
		return fmt.Errorf("%w: %s", ErrShortURLInvalidPath, p)
	}

	// Reject URLs containing a scheme (e.g. http://evil.com)
	if strings.Contains(p, "://") {
		return fmt.Errorf("%w: %s", ErrShortURLInvalidPath, p)
	}

	// Parse as URL and reject if it has a scheme (catches scheme:... patterns like javascript:alert(1))
	parsed, err := url.Parse(p)
	if err == nil && parsed.Scheme != "" {
		return fmt.Errorf("%w: %s", ErrShortURLInvalidPath, p)
	}

	// Reject absolute filesystem paths (starts with /)
	if path.IsAbs(p) {
		return fmt.Errorf("%w: %s", ErrShortURLAbsolutePath, p)
	}

	return nil
}

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

						return validateRelativePath(shortURL.Spec.Path)
					},
				},
				CustomRoutes: simple.AppCustomRouteHandlers{
					simple.AppCustomRoute{
						Method: "GET",
						Path:   "goto",
					}: func(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
						appURL, _, found := strings.Cut(req.URL.Path, "/apis/") // This will be settings.AppURL
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

func GetKinds() map[schema.GroupVersion][]resource.Kind {
	gv := schema.GroupVersion{
		Group:   shorturlv1beta1.ShortURLKind().Group(),
		Version: shorturlv1beta1.ShortURLKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {shorturlv1beta1.ShortURLKind()},
	}
}
