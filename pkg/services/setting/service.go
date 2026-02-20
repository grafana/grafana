package setting

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/hashicorp/golang-lru/v2/expirable"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
	"gopkg.in/ini.v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/transport"
	"k8s.io/client-go/util/flowcontrol"

	authlib "github.com/grafana/authlib/authn"
	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	logging "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/semconv"
)

// settingTracer wraps an otel tracer and implements the tracing.Tracer interface.
type settingTracer struct {
	trace.Tracer
}

// Inject propagates trace context into HTTP headers.
func (t *settingTracer) Inject(ctx context.Context, header http.Header, _ trace.Span) {
	otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(header))
}

var tracer tracing.Tracer = &settingTracer{otel.Tracer("github.com/grafana/grafana/pkg/services/setting")}

const LogPrefix = "setting.service"

const DefaultPageSize = int64(500)
const DefaultQPS = float32(15)
const DefaultBurst = 40
const DefaultCacheTTL = 1 * time.Second
const DefaultCacheMaxEntries = 1000

const (
	ApiGroup   = "setting.grafana.app"
	apiVersion = "v1beta1"
	resource   = "settings"
)

const defaultServiceName = "grafana"

// standard OpenTelemetry environment variable for service name.
// refer to: https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#general-sdk-configuration
const otelServiceNameEnvVar = "OTEL_SERVICE_NAME"

// longThrottleLatency defines the threshold for counting throttled requests.
const longThrottleLatency = 50 * time.Millisecond

var settingGroupVersion = schema.GroupVersion{
	Group:   ApiGroup,
	Version: apiVersion,
}

type clientMetrics struct {
	listDuration             *prometheus.HistogramVec
	listResultSize           prometheus.Histogram
	rateLimiterThrottleTotal prometheus.Counter
	cacheHitTotal            prometheus.Counter
}

// Service retrieves configuration settings from a remote settings service.
//
// The service uses label selectors to filter settings. Settings are labeled with
// "section" and "key" labels matching their spec fields.
//
// Example - Select all settings:
//
//	ctx := request.WithNamespace(context.Background(), "my-namespace")
//	ini, err := service.ListAsIni(ctx, metav1.LabelSelector{})
//
// Example - Select settings from specific sections:
//
//	selector := metav1.LabelSelector{
//	    MatchExpressions: []metav1.LabelSelectorRequirement{
//	        {
//	            Key:      "section",
//	            Operator: metav1.LabelSelectorOpIn,
//	            Values:   []string{"database", "server"},
//	        },
//	    },
//	}
//	ini, err := service.ListAsIni(ctx, selector)
//
// Example - Select settings from a single section with specific labels:
//
//	selector := metav1.LabelSelector{
//	    MatchLabels: map[string]string{
//	        "section": "database",
//	    },
//	}
//	settings, err := service.List(ctx, selector)
type Service interface {
	prometheus.Collector
	// ListAsIni retrieves settings filtered by a label selector from the namespace in context
	// and returns them as an ini.File.
	//
	// The namespace must be present in the context, ie: via request.WithNamespace.
	// An empty selector returns all settings in the namespace.
	ListAsIni(ctx context.Context, selector metav1.LabelSelector) (*ini.File, error)

	// List retrieves settings filtered by a label selector from the namespace in context
	// and returns them as a slice of Setting structs.
	//
	// The namespace must be present in the context, ie: via request.WithNamespace.
	// An empty selector returns all settings in the namespace.
	List(ctx context.Context, selector metav1.LabelSelector) ([]*Setting, error)
}

type remoteSettingService struct {
	restClient   *rest.RESTClient
	log          logging.Logger
	pageSize     int64
	metrics      clientMetrics
	cache        *expirable.LRU[string, []*Setting]  // nil when caching disabled
	fetchMutexes *expirable.LRU[string, *sync.Mutex] // per-cache-key fetch locks
	fetchMu      sync.Mutex                          // guards fetchMutexes get-or-create
}

var _ Service = (*remoteSettingService)(nil)
var _ prometheus.Collector = (*remoteSettingService)(nil)

// Config configures a Service.
type Config struct {
	// URL is the base URL for the remote settings service (required).
	URL string
	// TokenExchangeClient authenticates requests (required if WrapTransport is not set).
	TokenExchangeClient *authlib.TokenExchangeClient
	// WrapTransport wraps the HTTP transport for authentication.
	// Takes precedence over TokenExchangeClient when both are set.
	// At least one of WrapTransport or TokenExchangeClient is required.
	WrapTransport transport.WrapperFunc
	// TLSClientConfig configures TLS for the client connection.
	TLSClientConfig rest.TLSClientConfig
	// QPS limits requests per second (defaults to DefaultQPS).
	QPS float32
	// Burst allows request bursts above QPS (defaults to DefaultBurst).
	Burst int
	// PageSize sets the number of items per API page (defaults to DefaultPageSize).
	PageSize int64
	// ServiceName is used to identify the client in the UserAgent header.
	// The UserAgent format is "settings-client <version> (<service_name>)".
	// Falls back to the OTEL_SERVICE_NAME environment variable, then to "grafana".
	ServiceName string
	// CacheTTL sets the TTL for cached List results. Defaults to DefaultCacheTTL (1s).
	// Set to -1 to disable caching.
	CacheTTL time.Duration
	// CacheMaxEntries sets the max LRU cache entries. Defaults to DefaultCacheMaxEntries (1000).
	CacheMaxEntries int
}

// Setting represents the parsed spec of a Setting resource.
type Setting struct {
	// Setting section
	Section string `json:"section"`
	// Setting key
	Key string `json:"key"`
	// Setting value
	Value string `json:"value"`
	// Labels resource labels
	Labels map[string]string `json:"-"`
}

// settingResourceMetadata contains the metadata fields we care about from the K8s resource.
type settingResourceMetadata struct {
	Labels map[string]string `json:"labels,omitempty"`
}

// settingResource represents a single Setting resource from the K8s API.
type settingResource struct {
	Metadata settingResourceMetadata `json:"metadata"`
	Spec     Setting                 `json:"spec"`
}

// settingListMetadata contains pagination info from the K8s list response.
type settingListMetadata struct {
	Continue string `json:"continue,omitempty"`
}

// New creates a Service from the provided configuration.
func New(config Config) (Service, error) {
	log := logging.New(LogPrefix)
	metrics := initMetrics()

	restClient, err := getRestClient(config, log, metrics)
	if err != nil {
		return nil, fmt.Errorf("failed to create REST client: %w", err)
	}

	pageSize := DefaultPageSize
	if config.PageSize > 0 {
		pageSize = config.PageSize
	}

	cacheTTL := DefaultCacheTTL
	if config.CacheTTL > 0 {
		cacheTTL = config.CacheTTL
	}
	cacheMaxEntries := DefaultCacheMaxEntries
	if config.CacheMaxEntries > 0 {
		cacheMaxEntries = config.CacheMaxEntries
	}

	var cache *expirable.LRU[string, []*Setting]
	var fetchMutexes *expirable.LRU[string, *sync.Mutex]
	if config.CacheTTL >= 0 {
		cache = expirable.NewLRU[string, []*Setting](cacheMaxEntries, nil, cacheTTL)
		fetchMutexes = expirable.NewLRU[string, *sync.Mutex](cacheMaxEntries, nil, 2*cacheTTL)
	}

	return &remoteSettingService{
		restClient:   restClient,
		log:          log,
		pageSize:     pageSize,
		metrics:      metrics,
		cache:        cache,
		fetchMutexes: fetchMutexes,
	}, nil
}

func (s *remoteSettingService) ListAsIni(ctx context.Context, labelSelector metav1.LabelSelector) (*ini.File, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	ns := semconv.GrafanaNamespaceName(namespace)
	ctx, span := tracer.Start(ctx, "remoteSettingService.ListAsIni",
		trace.WithAttributes(ns))
	defer span.End()

	if !ok || namespace == "" {
		return nil, tracing.Errorf(span, "missing namespace in context")
	}

	settings, err := s.List(ctx, labelSelector)
	if err != nil {
		return nil, err
	}
	iniFile, err := toIni(ctx, settings)
	if err != nil {
		return nil, tracing.Error(span, err)
	}
	return iniFile, nil
}

func (s *remoteSettingService) List(ctx context.Context, labelSelector metav1.LabelSelector) (settings []*Setting, oErr error) {
	namespace, ok := request.NamespaceFrom(ctx)
	ns := semconv.GrafanaNamespaceName(namespace)
	ctx, span := tracer.Start(ctx, "remoteSettingService.List",
		trace.WithAttributes(ns))
	defer span.End()

	if !ok || namespace == "" {
		return nil, tracing.Errorf(span, "missing namespace in context")
	}
	log := s.log.FromContext(ctx).New(ns.Key, ns.Value, "function", "remoteSettingService.List", "traceId", span.SpanContext().TraceID())

	startTime := time.Now()
	var cacheHit bool
	// Uses the named return oErr to determine success/error status.
	// Cache-hit returns set cacheHit=true to skip duration observation,
	// since sub-millisecond cache lookups would skew the remote-call histogram.
	defer func() {
		if cacheHit {
			return
		}
		status := "success"
		if oErr != nil {
			status = "error"
		}
		s.metrics.listDuration.WithLabelValues(status).Observe(time.Since(startTime).Seconds())
	}()

	selector, err := metav1.LabelSelectorAsSelector(&labelSelector)
	if err != nil {
		return nil, tracing.Error(span, err)
	}
	if selector.Empty() {
		log.Debug("empty selector. Fetching all settings")
	}

	lSelector := selector.String()
	cacheKey := namespace + "|" + lSelector

	if s.cache != nil {
		if cached, ok := s.cache.Get(cacheKey); ok {
			cacheHit = true
			s.metrics.cacheHitTotal.Inc()
			return cached, nil
		}
	}

	if s.cache != nil {
		fetchMutex := s.getOrCreateFetchMutex(cacheKey)
		fetchMutex.Lock()
		defer fetchMutex.Unlock()

		if cached, ok := s.cache.Get(cacheKey); ok {
			cacheHit = true
			s.metrics.cacheHitTotal.Inc()
			return cached, nil
		}
	}

	allSettings, err := s.fetch(ctx, namespace, lSelector, span)
	if err != nil {
		return nil, err
	}

	if s.cache != nil {
		s.cache.Add(cacheKey, allSettings)
	}

	return allSettings, nil
}

func (s *remoteSettingService) getOrCreateFetchMutex(key string) *sync.Mutex {
	s.fetchMu.Lock()
	defer s.fetchMu.Unlock()
	if mu, ok := s.fetchMutexes.Get(key); ok {
		return mu
	}
	mu := &sync.Mutex{}
	s.fetchMutexes.Add(key, mu)
	return mu
}

// fetch retrieves all settings from the remote service using paginated requests.
func (s *remoteSettingService) fetch(ctx context.Context, namespace string, lSelector string, span trace.Span) ([]*Setting, error) {
	// Pre-allocate with estimated capacity
	allSettings := make([]*Setting, 0, s.pageSize*8)
	var continueToken string
	hasNext := true
	totalPages := 0
	// Using an upper limit to prevent infinite loops
	for hasNext && totalPages < 1000 {
		totalPages++

		settings, nextToken, lErr := s.fetchPage(ctx, namespace, lSelector, continueToken)
		if lErr != nil {
			return nil, tracing.Error(span, lErr)
		}

		allSettings = append(allSettings, settings...)
		continueToken = nextToken
		if continueToken == "" {
			hasNext = false
		}
	}
	s.metrics.listResultSize.Observe(float64(len(allSettings)))
	return allSettings, nil
}

func (s *remoteSettingService) fetchPage(ctx context.Context, namespace, labelSelector, continueToken string) ([]*Setting, string, error) {
	ctx, span := tracer.Start(ctx, "remoteSettingService.fetchPage")
	defer span.End()

	req := s.restClient.Get().
		Resource(resource).
		Namespace(namespace).
		Param("limit", fmt.Sprintf("%d", s.pageSize))

	if labelSelector != "" {
		req = req.Param("labelSelector", labelSelector)
	}
	if continueToken != "" {
		req = req.Param("continue", continueToken)
	}

	stream, err := req.Stream(ctx)
	if err != nil {
		return nil, "", fmt.Errorf("request failed: %w", err)
	}
	defer func() { _ = stream.Close() }()

	return parseSettingList(ctx, stream)
}

// parseSettingList parses a SettingList JSON response using token-by-token streaming.
func parseSettingList(ctx context.Context, r io.Reader) ([]*Setting, string, error) {
	_, span := tracer.Start(ctx, "remoteSettingService.parseSettingList")
	defer span.End()

	decoder := json.NewDecoder(r)
	// Currently, first page may have a large number of items.
	settings := make([]*Setting, 0, 1600)
	var continueToken string

	// Skip to the start of the object
	if _, err := decoder.Token(); err != nil {
		return nil, "", fmt.Errorf("expected start of object: %w", err)
	}

	for decoder.More() {
		// Read field name
		tok, err := decoder.Token()
		if err != nil {
			return nil, "", fmt.Errorf("failed to read field name: %w", err)
		}

		fieldName, ok := tok.(string)
		if !ok {
			continue
		}

		switch fieldName {
		case "metadata":
			var meta settingListMetadata
			if err := decoder.Decode(&meta); err != nil {
				return nil, "", fmt.Errorf("failed to decode metadata: %w", err)
			}
			continueToken = meta.Continue

		case "items":
			// Parse items array token-by-token
			itemSettings, err := parseItems(decoder)
			if err != nil {
				return nil, "", err
			}
			settings = append(settings, itemSettings...)

		default:
			// Skip unknown fields
			var skip json.RawMessage
			if err := decoder.Decode(&skip); err != nil {
				return nil, "", fmt.Errorf("failed to skip field %s: %w", fieldName, err)
			}
		}
	}

	return settings, continueToken, nil
}

func parseItems(decoder *json.Decoder) ([]*Setting, error) {
	// Expect start of array
	tok, err := decoder.Token()
	if err != nil {
		return nil, fmt.Errorf("expected start of items array: %w", err)
	}
	if tok != json.Delim('[') {
		return nil, fmt.Errorf("expected '[', got %v", tok)
	}

	settings := make([]*Setting, 0, DefaultPageSize)

	// Parse each item
	for decoder.More() {
		var item settingResource
		if err := decoder.Decode(&item); err != nil {
			return nil, fmt.Errorf("failed to decode setting item: %w", err)
		}
		settings = append(settings, &Setting{
			Section: item.Spec.Section,
			Key:     item.Spec.Key,
			Value:   item.Spec.Value,
			Labels:  item.Metadata.Labels,
		})
	}

	// Consume end of array
	if _, err := decoder.Token(); err != nil {
		return nil, fmt.Errorf("expected end of items array: %w", err)
	}

	return settings, nil
}

func toIni(ctx context.Context, settings []*Setting) (*ini.File, error) {
	_, span := tracer.Start(ctx, "remoteSettingService.toIni")
	defer span.End()

	conf := ini.Empty()
	for _, setting := range settings {
		if !conf.HasSection(setting.Section) {
			_, _ = conf.NewSection(setting.Section)
		}
		_, err := conf.Section(setting.Section).NewKey(setting.Key, setting.Value)
		if err != nil {
			return nil, err
		}
	}
	return conf, nil
}

func getRestClient(config Config, log logging.Logger, m clientMetrics) (*rest.RESTClient, error) {
	if config.URL == "" {
		return nil, fmt.Errorf("URL cannot be empty")
	}
	if config.WrapTransport == nil && config.TokenExchangeClient == nil {
		return nil, fmt.Errorf("must set either TokenExchangeClient or WrapTransport")
	}

	authTransport := config.WrapTransport
	if authTransport == nil {
		log.Debug("using default wrapTransport with TokenExchangeClient")
		authTransport = func(rt http.RoundTripper) http.RoundTripper {
			return &authRoundTripper{
				tokenClient: config.TokenExchangeClient,
				transport:   rt,
			}
		}
	}

	// Wrap with tracing middleware to propagate trace context to all outbound requests
	tracingMiddleware := httpclientprovider.TracingMiddleware(logging.NewNopLogger(), tracer)
	wrapTransport := func(rt http.RoundTripper) http.RoundTripper {
		tracingRT := tracingMiddleware.CreateMiddleware(httpclient.Options{}, rt)
		return authTransport(tracingRT)
	}

	qps := DefaultQPS
	if config.QPS > 0 {
		qps = config.QPS
	}

	burst := DefaultBurst
	if config.Burst > 0 {
		burst = config.Burst
	}

	serviceName := config.ServiceName
	if serviceName == "" {
		serviceName = os.Getenv(otelServiceNameEnvVar)
	}

	if serviceName == "" {
		serviceName = defaultServiceName
	}
	userAgent := fmt.Sprintf("settings-client %s (%s)", apiVersion, serviceName)

	// Add a default scheme to handle K8s API error responses
	scheme := runtime.NewScheme()

	// Create the rate limiter explicitly so we can wrap it with instrumentation
	rateLimiter := &instrumentedRateLimiter{
		RateLimiter: flowcontrol.NewTokenBucketRateLimiter(qps, burst),
		waitCounter: m.rateLimiterThrottleTotal,
	}

	restConfig := &rest.Config{
		Host:            config.URL,
		TLSClientConfig: config.TLSClientConfig,
		WrapTransport:   wrapTransport,
		RateLimiter:     rateLimiter,
		UserAgent:       userAgent,
		// Configure for our API group
		APIPath: "/apis",
		ContentConfig: rest.ContentConfig{
			GroupVersion:         &settingGroupVersion,
			NegotiatedSerializer: serializer.NewCodecFactory(scheme).WithoutConversion(),
		},
	}

	return rest.RESTClientFor(restConfig)
}

// authRoundTripper wraps an HTTP transport with token-based authentication.
type authRoundTripper struct {
	tokenClient *authlib.TokenExchangeClient
	transport   http.RoundTripper
}

var _ http.RoundTripper = (*authRoundTripper)(nil)

func (a *authRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	token, err := a.tokenClient.Exchange(req.Context(), authlib.TokenExchangeRequest{
		Audiences: []string{ApiGroup},
		Namespace: "*",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to exchange token: %w", err)
	}
	reqCopy := req.Clone(req.Context())
	reqCopy.Header.Set("X-Access-Token", fmt.Sprintf("Bearer %s", token.Token))
	return a.transport.RoundTrip(reqCopy)
}

// instrumentedRateLimiter wraps a flowcontrol.RateLimiter and increments a
// Prometheus counter each time Wait() blocks for longer than longThrottleLatency.
type instrumentedRateLimiter struct {
	flowcontrol.RateLimiter
	waitCounter prometheus.Counter
}

var _ flowcontrol.RateLimiter = (*instrumentedRateLimiter)(nil)

func (r *instrumentedRateLimiter) Wait(ctx context.Context) error {
	start := time.Now()
	err := r.RateLimiter.Wait(ctx)
	if time.Since(start) > longThrottleLatency {
		r.waitCounter.Inc()
	}
	return err
}

func initMetrics() clientMetrics {
	metrics := clientMetrics{
		listDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace:                   "settings",
				Subsystem:                   "service",
				Name:                        "list_settings_duration_seconds",
				Help:                        "Duration of remote settings service List operations",
				NativeHistogramBucketFactor: 1.1,
			},
			[]string{"status"}, // status: "success" or "error"
		),
		listResultSize: prometheus.NewHistogram(
			prometheus.HistogramOpts{
				Namespace:                   "settings",
				Subsystem:                   "service",
				Name:                        "list_settings_result_size",
				Help:                        "Number of settings returned by remote settings service List operations",
				NativeHistogramBucketFactor: 1.1,
			},
		),
		rateLimiterThrottleTotal: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: "settings",
			Subsystem: "service",
			Name:      "rate_limiter_throttle_total",
			Help:      "Total number of requests that waited more than 50ms due to client-side rate limiting",
		}),
		cacheHitTotal: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: "settings",
			Subsystem: "service",
			Name:      "list_settings_cache_hit_total",
			Help:      "Total number of List cache hits",
		}),
	}
	return metrics
}

func (s *remoteSettingService) Describe(descs chan<- *prometheus.Desc) {
	s.metrics.listDuration.Describe(descs)
	s.metrics.listResultSize.Describe(descs)
	s.metrics.rateLimiterThrottleTotal.Describe(descs)
	s.metrics.cacheHitTotal.Describe(descs)
}

func (s *remoteSettingService) Collect(metrics chan<- prometheus.Metric) {
	s.metrics.listDuration.Collect(metrics)
	s.metrics.listResultSize.Collect(metrics)
	s.metrics.rateLimiterThrottleTotal.Collect(metrics)
	s.metrics.cacheHitTotal.Collect(metrics)
}
