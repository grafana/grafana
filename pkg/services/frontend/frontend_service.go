package frontend

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/middleware/loggermw"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"

	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
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

	// Create a custom DirectRestConfigProvider for the frontend service
	// that connects to the remote grafana-api server instead of local
	frontendClientConfigProvider := &frontendDirectRestConfigProvider{
		cfg: cfg,
		log: log.New("frontend-k8s-client"),
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
		clientConfigProvider: frontendClientConfigProvider,
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
	s.log.Info("Handling goto request", "uid", request.URL.Path, "method", request.Method)

	// Extract UID from uid like /goto/abc123
	uid := strings.TrimPrefix(request.URL.Path, "/goto/")
	if uid == "" || uid == request.URL.Path {
		// No UID found, serve index page
		s.log.Debug("No UID found in goto uid, serving index page", "original_path", request.URL.Path)
		s.index.HandleRequest(writer, request)
		return
	}

	s.log.Info("Extracted UID from goto uid", "uid", uid, "original_path", request.URL.Path)

	// Check if this looks like a valid short URL UID
	if !util.IsValidShortUID(uid) {
		s.log.Warn("Invalid short URL UID format, redirecting to app URL", "uid", uid)
		http.Redirect(writer, request, s.cfg.AppURL, http.StatusFound)
		return
	}

	// Check feature flag and client availability
	featureEnabled := s.features.IsEnabledGlobally(featuremgmt.FlagKubernetesShortURLs)
	hasClient := s.clientConfigProvider != nil

	s.log.Info("Checking Kubernetes short URL availability",
		"uid", uid,
		"feature_enabled", featureEnabled,
		"has_client", hasClient,
		"app_url", s.cfg.AppURL)

	// Only handle Kubernetes short URLs if the feature is enabled and we have a client config provider
	if !featureEnabled || !hasClient {
		// Feature not enabled or no client config provider, redirect to app URL to avoid infinite loop
		s.log.Warn("Kubernetes short URLs not available, redirecting to app URL",
			"uid", uid,
			"feature_enabled", featureEnabled,
			"has_client", hasClient,
			"redirect_url", s.cfg.AppURL)
		http.Redirect(writer, request, s.cfg.AppURL, http.StatusFound)
		return
	}

	// Handle Kubernetes short URL redirect directly
	s.log.Info("Attempting Kubernetes short URL redirect", "uid", uid)
	s.handleKubernetesShortURLRedirect(writer, request, uid)
}

// handleKubernetesShortURLRedirect handles the short URL redirect using K8s client (like short_url.go)
func (s *frontendService) handleKubernetesShortURLRedirect(writer http.ResponseWriter, request *http.Request, shortURLUID string) {
	s.log.Info("Starting Kubernetes short URL redirect", "uid", shortURLUID)

	// Get the ReqContext from the request (set by our context middleware)
	reqCtx := contexthandler.FromContext(request.Context())
	if reqCtx == nil {
		s.log.Error("No ReqContext found in request")
		s.index.HandleRequest(writer, request)
		return
	}

	client, ok := s.getK8sClient(reqCtx)
	if !ok {
		s.log.Error("Failed to get Kubernetes client")
		s.index.HandleRequest(writer, request)
		return
	}

	// Get Object from Kubernetes
	shortURLObj, err := client.Get(request.Context(), shortURLUID, v1.GetOptions{})
	if err != nil {
		s.log.Error("Failed to get short URL from Kubernetes", "uid", shortURLUID, "error", err)
		s.writeKubernetesError(writer, request, err)
		return
	}

	// Update lastSeenAt timestamp (same logic as short_url.go)
	status := shortURLObj.Object["status"].(map[string]interface{})
	newTimestamp := time.Now().Unix()
	status["lastSeenAt"] = newTimestamp

	// Try status subresource first (works in Mode 5), fallback to main resource (works in Mode 0)
	out, err := client.Update(request.Context(), shortURLObj, v1.UpdateOptions{}, "status")
	if err != nil {
		s.log.Debug("Status subresource update failed, trying main resource", "error", err)
		// Fallback to main resource update (for Mode 0)
		out, err = client.Update(request.Context(), shortURLObj, v1.UpdateOptions{})
		if err != nil {
			s.log.Warn("Both status and main resource updates failed, continuing with redirect", "error", err)
			// Continue with redirect even if update fails - use original object
			out = shortURLObj
		}
	}

	// Extract path from spec (same as short_url.go)
	spec := out.Object["spec"].(map[string]any)
	path := spec["path"].(string)

	// Perform redirect
	redirectURL := setting.ToAbsUrl(path)
	s.log.Info("Performing redirect", "uid", shortURLUID, "target_path", path, "redirect_url", redirectURL)
	http.Redirect(writer, request, redirectURL, http.StatusFound)
}

// getK8sClient creates a Kubernetes dynamic client
func (s *frontendService) getK8sClient(c *contextmodel.ReqContext) (dynamic.ResourceInterface, bool) {
	// Add defensive checks
	if s.clientConfigProvider == nil {
		s.log.Error("clientConfigProvider is nil - frontend service not properly configured for K8s")
		return nil, false
	}

	// Get REST config with proper error handling
	restConfig := s.clientConfigProvider.GetDirectRestConfig(c)
	if restConfig == nil {
		s.log.Error("GetDirectRestConfig returned nil - API server may not be available for frontend service",
			"user_id", c.SignedInUser.UserID,
			"org_id", c.OrgID,
			"login", c.SignedInUser.Login)
		return nil, false
	}

	s.log.Debug("Got REST config from clientConfigProvider",
		"host", restConfig.Host,
		"user_id", c.SignedInUser.UserID,
		"org_id", c.OrgID)

	dyn, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		s.log.Error("Failed to create dynamic client", "error", err)
		return nil, false
	}
	return dyn.Resource(s.gvr).Namespace(s.namespacer(c.OrgID)), true
}

// writeKubernetesError handles Kubernetes API errors (same as short_url.go)
func (s *frontendService) writeKubernetesError(writer http.ResponseWriter, request *http.Request, err error) {
	//nolint:errorlint
	statusError, ok := err.(*errors.StatusError)
	if ok {
		statusCode := statusError.Status().Code
		s.log.Warn("Kubernetes API status error during short URL redirect",
			"status_code", statusCode,
			"message", statusError.Status().Message,
			"error", err)

		if statusCode == 404 {
			s.log.Info("Short URL not found in Kubernetes, serving index page")
		}
	} else {
		s.log.Error("Non-status Kubernetes API error during short URL redirect", "error", err)
	}

	// Fallback to serving index page instead of redirecting to app URL
	s.index.HandleRequest(writer, request)
}

// frontendDirectRestConfigProvider is a custom DirectRestConfigProvider for the frontend service
// that connects to the remote Grafana API server instead of expecting a local one
type frontendDirectRestConfigProvider struct {
	cfg *setting.Cfg
	log log.Logger
}

func (f *frontendDirectRestConfigProvider) GetDirectRestConfig(c *contextmodel.ReqContext) *rest.Config {
	f.log.Debug("Creating REST config for remote Grafana API server",
		"user_id", c.SignedInUser.UserID,
		"org_id", c.OrgID,
		"login", c.SignedInUser.Login)

	// Create a REST config that connects to the remote grafana-api server
	return &rest.Config{
		Host: "http://grafana-api:3000",
		Transport: &frontendRoundTripper{
			originalRequest: c.Req,
			log:             f.log,
		},
	}
}

func (f *frontendDirectRestConfigProvider) DirectlyServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Not implemented for frontend service
	f.log.Error("DirectlyServeHTTP not implemented for frontend service")
	http.Error(w, "Not implemented", http.StatusNotImplemented)
}

// frontendRoundTripper implements http.RoundTripper to proxy K8s API requests
// to the remote Grafana API server with proper authentication forwarding
type frontendRoundTripper struct {
	originalRequest *http.Request
	log             log.Logger
}

func (f *frontendRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	f.log.Debug("Forwarding K8s API request to remote Grafana API server",
		"method", req.Method,
		"url", req.URL.String(),
		"path", req.URL.Path)

	// Create new request to the remote Grafana API server
	remoteURL := "http://grafana-api:3000" + req.URL.Path
	if req.URL.RawQuery != "" {
		remoteURL += "?" + req.URL.RawQuery
	}

	proxyReq, err := http.NewRequestWithContext(req.Context(), req.Method, remoteURL, req.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to create proxy request: %w", err)
	}

	// Copy all headers from the original request
	for name, values := range req.Header {
		for _, value := range values {
			proxyReq.Header.Add(name, value)
		}
	}

	// Copy authentication headers from the original frontend request
	if f.originalRequest != nil {
		for name, values := range f.originalRequest.Header {
			if name == "Cookie" || name == "Authorization" || strings.HasPrefix(name, "X-Grafana") {
				for _, value := range values {
					proxyReq.Header.Set(name, value) // Use Set to override K8s client headers
				}
			}
		}
	}

	f.log.Debug("Making proxied request to Grafana API server",
		"url", remoteURL,
		"headers_count", len(proxyReq.Header))

	// Make the request
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(proxyReq)
	if err != nil {
		return nil, fmt.Errorf("failed to proxy K8s API request: %w", err)
	}

	f.log.Debug("Received response from Grafana API server",
		"status", resp.Status,
		"status_code", resp.StatusCode)

	return resp, nil
}
