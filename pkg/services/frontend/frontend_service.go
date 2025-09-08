package frontend

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/middleware/loggermw"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"

	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/frontend")

type frontendService struct {
	*services.BasicService
	cfg                  *setting.Cfg
	httpServ             *http.Server
	features             featuremgmt.FeatureToggles
	log                  log.Logger
	errChan              chan error
	promGatherer         prometheus.Gatherer
	promRegister         prometheus.Registerer
	tracer               trace.Tracer
	license              licensing.Licensing
	clientConfigProvider grafanaapiserver.DirectRestConfigProvider

	index      *IndexProvider
	namespacer request.NamespaceMapper
	gvr        schema.GroupVersionResource
}

func ProvideFrontendService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, promGatherer prometheus.Gatherer, promRegister prometheus.Registerer, license licensing.Licensing, clientConfigProvider grafanaapiserver.DirectRestConfigProvider) (*frontendService, error) {
	index, err := NewIndexProvider(cfg, license)
	if err != nil {
		return nil, err
	}

	gvr := schema.GroupVersionResource{
		Group:    v1alpha1.ShortURLKind().Group(),
		Version:  v1alpha1.ShortURLKind().Version(),
		Resource: v1alpha1.ShortURLKind().Plural(),
	}

	s := &frontendService{
		cfg:                  cfg,
		features:             features,
		log:                  log.New("frontend-server"),
		promGatherer:         promGatherer,
		promRegister:         promRegister,
		tracer:               tracer,
		license:              license,
		index:                index,
		clientConfigProvider: clientConfigProvider,
		namespacer:           request.GetNamespaceMapper(cfg),
		gvr:                  gvr,
	}
	s.BasicService = services.NewBasicService(s.start, s.running, s.stop)
	return s, nil
}

func (s *frontendService) start(ctx context.Context) error {
	s.log.Info("starting frontend server")
	s.httpServ = s.newFrontendServer(ctx)
	s.errChan = make(chan error)
	go func() {
		s.errChan <- s.httpServ.ListenAndServe()
	}()
	return nil
}

func (s *frontendService) running(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return nil
	case err := <-s.errChan:
		return err
	}
}

func (s *frontendService) stop(failureReason error) error {
	s.log.Info("stopping frontend server", "reason", failureReason)

	if err := s.httpServ.Shutdown(context.Background()); err != nil {
		s.log.Error("failed to shutdown frontend server", "error", err)
		return err
	}
	return nil
}

func (s *frontendService) newFrontendServer(ctx context.Context) *http.Server {
	// Use the same web.Mux as the main grafana server for consistency + middleware reuse
	handler := web.New()
	s.addMiddlewares(handler)
	s.registerRoutes(handler)

	server := &http.Server{
		// 5s timeout for header reads to avoid Slowloris attacks (https://thetooth.io/blog/slowloris-attack/)
		ReadHeaderTimeout: 5 * time.Second,
		Addr:              ":" + s.cfg.HTTPPort,
		Handler:           handler,
		BaseContext:       func(_ net.Listener) context.Context { return ctx },
	}

	return server
}

func (s *frontendService) routeGet(m *web.Mux, pattern string, h ...web.Handler) {
	handlers := append([]web.Handler{middleware.ProvideRouteOperationName(pattern)}, h...)
	m.Get(pattern, handlers...)
}

// Apply the same middleware patterns as the main HTTP server
func (s *frontendService) addMiddlewares(m *web.Mux) {
	loggermiddleware := loggermw.Provide(s.cfg, s.features)

	m.Use(requestmeta.SetupRequestMetadata())
	m.UseMiddleware(s.contextMiddleware())

	m.Use(middleware.RequestTracing(s.tracer, middleware.TraceAllPaths))
	m.Use(middleware.RequestMetrics(s.features, s.cfg, s.promRegister))
	m.UseMiddleware(loggermiddleware.Middleware())

	m.UseMiddleware(middleware.Recovery(s.cfg, s.license))
}

func (s *frontendService) registerRoutes(m *web.Mux) {
	s.routeGet(m, "/metrics", promhttp.HandlerFor(s.promGatherer, promhttp.HandlerOpts{EnableOpenMetrics: true}))

	// Frontend service doesn't (yet?) serve any assets, so explicitly 404
	// them so we can get logs for them
	s.routeGet(m, "/public/*", http.NotFound)

	s.routeGet(m, "/goto/*", s.handleGotoRequest)
	// All other requests return index.html
	s.routeGet(m, "/*", s.index.HandleRequest)
}

// handleGotoRequest handles /goto/* requests by checking if it's a short URL redirect
// or falling back to serving the index page
func (s *frontendService) handleGotoRequest(writer http.ResponseWriter, request *http.Request) {
	s.log.Info("Handling goto request", "path", request.URL.Path, "method", request.Method)

	// Extract UID from path like /goto/abc123
	path := strings.TrimPrefix(request.URL.Path, "/goto/")
	if path == "" || path == request.URL.Path {
		// No UID found, serve index page
		s.log.Debug("No UID found in goto path, serving index page", "original_path", request.URL.Path)
		s.index.HandleRequest(writer, request)
		return
	}

	s.log.Info("Extracted UID from goto path", "uid", path, "original_path", request.URL.Path)

	// Check if this looks like a valid short URL UID
	if !util.IsValidShortUID(path) {
		s.log.Warn("Invalid short URL UID format, redirecting to app URL", "uid", path)
		http.Redirect(writer, request, s.cfg.AppURL, http.StatusFound)
		return
	}

	// Check feature flag and client availability
	featureEnabled := s.features.IsEnabledGlobally(featuremgmt.FlagKubernetesShortURLs)
	hasClient := s.clientConfigProvider != nil

	s.log.Info("Checking Kubernetes short URL availability",
		"uid", path,
		"feature_enabled", featureEnabled,
		"has_client", hasClient,
		"app_url", s.cfg.AppURL)

	// Only handle Kubernetes short URLs if the feature is enabled and we have a client config provider
	if !featureEnabled || !hasClient {
		// Feature not enabled or no client config provider, redirect to app URL to avoid infinite loop
		s.log.Warn("Kubernetes short URLs not available, redirecting to app URL",
			"uid", path,
			"feature_enabled", featureEnabled,
			"has_client", hasClient,
			"redirect_url", s.cfg.AppURL)
		http.Redirect(writer, request, s.cfg.AppURL, http.StatusFound)
		return
	}

	// Handle Kubernetes short URL redirect directly
	s.log.Info("Attempting Kubernetes short URL redirect", "uid", path)
	s.handleKubernetesShortURLRedirect(writer, request, path)
}

// handleKubernetesShortURLRedirect handles the short URL redirect by calling the K8s API
func (s *frontendService) handleKubernetesShortURLRedirect(writer http.ResponseWriter, request *http.Request, shortURLUID string) {
	s.log.Info("Starting short URL redirect via K8s API", "uid", shortURLUID)

	// Get the short URL data from the K8s API
	targetPath, err := s.getShortURLFromAPI(request, shortURLUID)
	if err != nil {
		s.log.Error("Failed to get short URL from K8s API", "uid", shortURLUID, "error", err)
		// Fallback to serving index page
		s.index.HandleRequest(writer, request)
		return
	}

	// Perform the redirect
	redirectURL := setting.ToAbsUrl(targetPath)
	s.log.Info("Performing redirect", "uid", shortURLUID, "target_path", targetPath, "redirect_url", redirectURL)
	http.Redirect(writer, request, redirectURL, http.StatusFound)
}

// getShortURLFromAPI gets the short URL data from the Kubernetes API via the Grafana API server
func (s *frontendService) getShortURLFromAPI(request *http.Request, shortURLUID string) (string, error) {
	s.log.Info("Fetching short URL from Kubernetes API via Grafana API server", "uid", shortURLUID)

	// For org ID = 1, the namespace will be "org-1" (based on the namespace mapper)
	namespace := s.namespacer(1) // Using org ID 1 for now - in production, extract from auth

	// Create request to the Kubernetes API endpoint via Grafana API server
	apiURL := fmt.Sprintf("http://grafana-api:3000/apis/shorturl.grafana.app/v1alpha1/namespaces/%s/shorturls/%s", namespace, shortURLUID)

	s.log.Debug("Making Kubernetes API request", "url", apiURL, "namespace", namespace)

	apiReq, err := http.NewRequestWithContext(request.Context(), "GET", apiURL, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create K8s API request: %w", err)
	}

	// Copy authentication headers from the original request
	for name, values := range request.Header {
		// Copy authentication-related headers
		if name == "Cookie" || name == "Authorization" || strings.HasPrefix(name, "X-Grafana") {
			for _, value := range values {
				apiReq.Header.Add(name, value)
			}
		}
	}

	// Make the request
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(apiReq)
	if err != nil {
		return "", fmt.Errorf("failed to fetch short URL from K8s API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return "", fmt.Errorf("short URL not found in Kubernetes")
	}

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("K8s API request failed with status %d", resp.StatusCode)
	}

	// Parse the Kubernetes API response - it follows the standard K8s resource structure
	var k8sResponse struct {
		APIVersion string `json:"apiVersion"`
		Kind       string `json:"kind"`
		Metadata   struct {
			Name      string `json:"name"`
			Namespace string `json:"namespace"`
		} `json:"metadata"`
		Spec struct {
			Path string `json:"path"`
		} `json:"spec"`
		Status struct {
			LastSeenAt int64 `json:"lastSeenAt,omitempty"`
		} `json:"status,omitempty"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&k8sResponse); err != nil {
		return "", fmt.Errorf("failed to decode K8s API response: %w", err)
	}

	s.log.Info("Successfully fetched short URL from K8s API",
		"uid", shortURLUID,
		"path", k8sResponse.Spec.Path,
		"namespace", k8sResponse.Metadata.Namespace)

	return k8sResponse.Spec.Path, nil
}
