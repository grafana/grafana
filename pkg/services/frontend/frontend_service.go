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
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/middleware/loggermw"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"

	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/contexthandler"
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

// handleKubernetesShortURLRedirect handles the Kubernetes short URL redirect logic
func (s *frontendService) handleKubernetesShortURLRedirect(writer http.ResponseWriter, request *http.Request, shortURLUID string) {
	s.log.Info("Starting Kubernetes short URL redirect", "uid", shortURLUID)

	client, err := s.getKubernetesClient(request)
	if err != nil {
		s.log.Error("Failed to get Kubernetes client, redirecting to app URL", "uid", shortURLUID, "error", err)
		http.Redirect(writer, request, s.cfg.AppURL, http.StatusFound)
		return
	}

	s.log.Info("Successfully created Kubernetes client, fetching short URL", "uid", shortURLUID)

	// Get the short URL object from Kubernetes
	obj, err := client.Get(request.Context(), shortURLUID, v1.GetOptions{})
	if err != nil {
		s.log.Error("Failed to get short URL from Kubernetes", "uid", shortURLUID, "error", err)
		s.writeKubernetesError(writer, request, err)
		return
	}

	s.log.Info("Successfully retrieved short URL object from Kubernetes", "uid", shortURLUID)

	// Extract path from spec before updating (in case update fails)
	spec, ok := obj.Object["spec"].(map[string]any)
	if !ok {
		s.log.Error("Invalid spec format in short URL object", "uid", shortURLUID)
		http.Redirect(writer, request, s.cfg.AppURL, http.StatusFound)
		return
	}

	targetPath, ok := spec["path"].(string)
	if !ok {
		s.log.Error("Invalid path format in short URL spec", "uid", shortURLUID)
		http.Redirect(writer, request, s.cfg.AppURL, http.StatusFound)
		return
	}

	s.log.Info("Extracted target path from short URL", "uid", shortURLUID, "target_path", targetPath)

	// Update lastSeenAt timestamp (best effort - don't fail redirect if this fails)
	if status, ok := obj.Object["status"].(map[string]interface{}); ok {
		newTimestamp := time.Now().Unix()
		status["lastSeenAt"] = newTimestamp

		// Try status subresource first (works in Mode 5), fallback to main resource (works in Mode 0)
		_, err = client.Update(request.Context(), obj, v1.UpdateOptions{}, "status")
		if err != nil {
			s.log.Debug("Status subresource update failed, trying main resource", "uid", shortURLUID, "error", err)
			// Fallback to main resource update (for Mode 0)
			_, err = client.Update(request.Context(), obj, v1.UpdateOptions{})
			if err != nil {
				s.log.Warn("Both status and main resource updates failed, continuing with redirect", "uid", shortURLUID, "error", err)
				// Continue with redirect even if update fails
			} else {
				s.log.Debug("Successfully updated lastSeenAt via main resource", "uid", shortURLUID)
			}
		} else {
			s.log.Debug("Successfully updated lastSeenAt via status subresource", "uid", shortURLUID)
		}
	} else {
		s.log.Warn("No status object found in short URL, skipping lastSeenAt update", "uid", shortURLUID)
	}

	// Perform the redirect
	redirectURL := setting.ToAbsUrl(targetPath)
	s.log.Info("Performing redirect", "uid", shortURLUID, "target_path", targetPath, "redirect_url", redirectURL)
	http.Redirect(writer, request, redirectURL, http.StatusFound)
}

// getKubernetesClient creates a Kubernetes dynamic client with proper authentication context
func (s *frontendService) getKubernetesClient(request *http.Request) (dynamic.ResourceInterface, error) {
	s.log.Info("Creating Kubernetes client")

	// Get the ReqContext from the request (set by our context middleware)
	reqCtx := contexthandler.FromContext(request.Context())
	if reqCtx == nil {
		s.log.Error("No ReqContext found in request")
		return nil, fmt.Errorf("no request context found")
	}

	if reqCtx.SignedInUser == nil {
		s.log.Error("No SignedInUser found in request context")
		return nil, fmt.Errorf("no signed in user found")
	}

	s.log.Info("Getting REST config from client config provider",
		"user_id", reqCtx.SignedInUser.UserID,
		"org_id", reqCtx.SignedInUser.OrgID,
		"login", reqCtx.SignedInUser.Login)

	// The eventualRestConfigProvider waits for the API server to be ready
	// Add retry logic with exponential backoff to wait for API server startup
	var restConfig *clientrest.Config
	maxRetries := 5
	baseDelay := 500 * time.Millisecond

	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			delay := time.Duration(1<<attempt) * baseDelay // Exponential backoff: 500ms, 1s, 2s, 4s, 8s
			s.log.Info("Retrying REST config after delay", "attempt", attempt+1, "delay", delay)
			time.Sleep(delay)
		}

		s.log.Debug("Attempting to get REST config", "attempt", attempt+1)

		// Create a timeout context to prevent GetDirectRestConfig from blocking indefinitely
		// The eventualRestConfigProvider blocks until API server is ready, so we need a timeout
		timeoutCtx, cancel := context.WithTimeout(request.Context(), 3*time.Second)
		reqCtxWithTimeout := *reqCtx // Copy the context
		reqCtxWithTimeout.Req = reqCtx.Req.WithContext(timeoutCtx)

		restConfig = s.clientConfigProvider.GetDirectRestConfig(&reqCtxWithTimeout)
		cancel() // Always cancel the timeout context

		if restConfig != nil {
			s.log.Info("Successfully got REST config from client config provider", "attempt", attempt+1)
			break
		}

		s.log.Warn("Client config provider returned nil REST config, API server may not be ready yet",
			"attempt", attempt+1, "max_attempts", maxRetries)
	}

	if restConfig == nil {
		s.log.Error("Failed to get REST config after all retries - API server not ready", "max_attempts", maxRetries)
		return nil, fmt.Errorf("API server not ready after %d attempts", maxRetries)
	}

	// Create dynamic client
	dyn, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	// Use the user's org ID for namespace mapping
	namespace := s.namespacer(reqCtx.SignedInUser.OrgID)

	s.log.Info("Created Kubernetes client", "namespace", namespace, "gvr", s.gvr)
	return dyn.Resource(s.gvr).Namespace(namespace), nil
}

// writeKubernetesError handles Kubernetes API errors
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
			s.log.Info("Short URL not found in Kubernetes, redirecting to app URL")
		}
	} else {
		s.log.Error("Non-status Kubernetes API error during short URL redirect", "error", err)
	}

	s.log.Info("Redirecting to app URL due to Kubernetes error", "redirect_url", s.cfg.AppURL)
	http.Redirect(writer, request, s.cfg.AppURL, http.StatusFound)
}
