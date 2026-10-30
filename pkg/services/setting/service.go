package setting

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/hashicorp/golang-lru/v2/expirable"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/protobuf/proto"
	"gopkg.in/ini.v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/transport"
	"k8s.io/client-go/util/flowcontrol"

	authlib "github.com/grafana/authlib/authn"
	"github.com/grafana/dskit/instrument"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	logging "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
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
const DefaultQPS = float32(200)
const DefaultBurst = 300
const DefaultCacheTTL = 5 * time.Second
const DefaultCacheMaxEntries = 1000

// DefaultSubscribedCacheTTL applies instead of DefaultCacheTTL when change events keep the cache fresh;
// the TTL is then only a backstop for missed events.
const DefaultSubscribedCacheTTL = time.Minute

// Values of the reason label on the cache invalidation counter.
const (
	invalidationReasonEvent        = "event"         // a change event for one namespace
	invalidationReasonReconnect    = "reconnect"     // events may have been missed; whole cache flushed
	invalidationReasonInvalidEvent = "invalid_event" // event without a usable namespace; whole cache flushed
)

// DefaultIdleConnTimeout caps how long idle keep-alive connections are pooled.
const DefaultIdleConnTimeout = 30 * time.Second

const (
	ApiGroup   = "setting.grafana.app"
	apiVersion = "v1"
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
	cacheMissTotal           prometheus.Counter
	cacheEvictionTotal       prometheus.Counter
	cacheSize                prometheus.Gauge
	cacheMaxSize             prometheus.Gauge
	cacheInvalidationTotal   *prometheus.CounterVec
	cacheSubscribed          prometheus.Gauge
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

// FieldSelectorService keeps field-filtered queries separate so existing Service implementations remain compatible.
type FieldSelectorService interface {
	Service
	ListWithFieldSelector(ctx context.Context, selector metav1.LabelSelector, fieldSelector fields.Selector) ([]*Setting, error)
	ListAsIniWithFieldSelector(ctx context.Context, selector metav1.LabelSelector, fieldSelector fields.Selector) (*ini.File, error)
}

type remoteSettingService struct {
	restClient   *rest.RESTClient
	log          logging.Logger
	pageSize     int64
	metrics      clientMetrics
	cache        *expirable.LRU[string, []*Setting]  // nil when caching disabled
	fetchMutexes *expirable.LRU[string, *sync.Mutex] // per-cache-key fetch locks
	fetchMu      sync.Mutex                          // guards fetchMutexes get-or-create
	// invalidations counts change events; a fetch that overlapped one must not populate the cache.
	invalidations atomic.Uint64
}

// EventSubscriber delivers settings change notifications from the message bus.
type EventSubscriber interface {
	Enabled() bool
	// Subscribe must deliver every event to every subscriber (no queue group).
	// onReconnect is called after a reconnection, never on the initial connection.
	Subscribe(ctx context.Context, subject string, handler func(subject string, data []byte), onReconnect func()) error
}

var _ FieldSelectorService = (*remoteSettingService)(nil)
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
	// CacheTTL sets the TTL for cached List results. Defaults to DefaultCacheTTL.
	// Set to -1 to disable caching.
	CacheTTL time.Duration
	// EventSubscriber, when set and enabled, invalidates cached entries on settings changes.
	// CacheTTL then defaults to DefaultSubscribedCacheTTL and acts as a backstop.
	EventSubscriber EventSubscriber
	// CacheMaxEntries sets the max LRU cache entries. Defaults to DefaultCacheMaxEntries (1000).
	CacheMaxEntries int
	// IdleConnTimeout caps how long idle keep-alive connections are pooled before
	// being closed. Defaults to DefaultIdleConnTimeout. Set to a negative value to use the
	// client-go default.
	IdleConnTimeout time.Duration
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
func New(config Config) (FieldSelectorService, error) {
	log := logging.New(LogPrefix)
	metrics := initMetrics(resolveServiceName(config))

	restClient, err := getRestClient(config, log, metrics)
	if err != nil {
		return nil, fmt.Errorf("failed to create REST client: %w", err)
	}

	pageSize := DefaultPageSize
	if config.PageSize > 0 {
		pageSize = config.PageSize
	}

	subscribe := config.CacheTTL >= 0 && config.EventSubscriber != nil && config.EventSubscriber.Enabled()
	cacheTTL := DefaultCacheTTL
	if subscribe {
		cacheTTL = DefaultSubscribedCacheTTL
	}
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
		metrics.cacheMaxSize.Set(float64(cacheMaxEntries))
	}

	svc := &remoteSettingService{
		restClient:   restClient,
		log:          log,
		pageSize:     pageSize,
		metrics:      metrics,
		cache:        cache,
		fetchMutexes: fetchMutexes,
	}
	if subscribe && !svc.subscribe(config.EventSubscriber) && config.CacheTTL == 0 {
		// no events will arrive, so the longer TTL would only serve stale data
		svc.cache = expirable.NewLRU[string, []*Setting](cacheMaxEntries, nil, DefaultCacheTTL)
		svc.fetchMutexes = expirable.NewLRU[string, *sync.Mutex](cacheMaxEntries, nil, 2*DefaultCacheTTL)
	}
	return svc, nil
}

// subscribe wires cache invalidation to settings change events and reports success.
func (s *remoteSettingService) subscribe(sub EventSubscriber) bool {
	gvr := schema.GroupVersionResource{Group: ApiGroup, Version: apiVersion, Resource: resource}
	subject := resourcewatch.Subject(gvr, "")
	err := sub.Subscribe(context.Background(), subject, s.handleEvent, s.handleReconnect)
	if err != nil {
		s.log.Warn("failed to subscribe to settings change events, relying on cache TTL", "subject", subject, "error", err)
		return false
	}
	s.metrics.cacheSubscribed.Set(1)
	return true
}

func (s *remoteSettingService) handleEvent(subject string, data []byte) {
	var n resourcepb.WatchNotification
	if err := proto.Unmarshal(data, &n); err != nil || n.Namespace == "" {
		s.log.Warn("unusable settings change event, flushing cache", "subject", subject, "error", err)
		s.invalidateAll(invalidationReasonInvalidEvent)
		return
	}
	s.invalidations.Add(1)
	s.metrics.cacheInvalidationTotal.WithLabelValues(invalidationReasonEvent).Inc()
	prefix := n.Namespace + "|"
	for _, key := range s.cache.Keys() {
		if strings.HasPrefix(key, prefix) {
			s.cache.Remove(key)
		}
	}
}

func (s *remoteSettingService) handleReconnect() {
	s.log.Info("settings event subscription reconnected, flushing cache", "entries", s.cache.Len())
	s.invalidateAll(invalidationReasonReconnect)
}

func (s *remoteSettingService) invalidateAll(reason string) {
	s.invalidations.Add(1)
	s.metrics.cacheInvalidationTotal.WithLabelValues(reason).Inc()
	s.cache.Purge()
}

func (s *remoteSettingService) ListAsIni(ctx context.Context, labelSelector metav1.LabelSelector) (*ini.File, error) {
	return s.ListAsIniWithFieldSelector(ctx, labelSelector, nil)
}

func (s *remoteSettingService) ListAsIniWithFieldSelector(ctx context.Context, labelSelector metav1.LabelSelector, fieldSelector fields.Selector) (*ini.File, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	ns := attribute.String("grafana.namespace.name", namespace)
	ctx, span := tracer.Start(ctx, "remoteSettingService.ListAsIni",
		trace.WithAttributes(ns))
	defer span.End()

	if !ok || namespace == "" {
		return nil, tracing.Errorf(span, "missing namespace in context")
	}

	settings, err := s.ListWithFieldSelector(ctx, labelSelector, fieldSelector)
	if err != nil {
		return nil, err
	}
	iniFile, err := toIni(ctx, settings)
	if err != nil {
		return nil, tracing.Error(span, err)
	}
	return iniFile, nil
}

func (s *remoteSettingService) List(ctx context.Context, labelSelector metav1.LabelSelector) ([]*Setting, error) {
	return s.ListWithFieldSelector(ctx, labelSelector, nil)
}

func (s *remoteSettingService) ListWithFieldSelector(ctx context.Context, labelSelector metav1.LabelSelector, fieldSelector fields.Selector) (settings []*Setting, oErr error) {
	namespace, ok := request.NamespaceFrom(ctx)
	ns := attribute.String("grafana.namespace.name", namespace)
	ctx, span := tracer.Start(ctx, "remoteSettingService.List",
		trace.WithAttributes(ns))
	defer span.End()

	if !ok || namespace == "" {
		oErr = tracing.Errorf(span, "missing namespace in context")
		return nil, oErr
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
		oErr = tracing.Error(span, err)
		return nil, oErr
	}
	fSelector := ""
	if fieldSelector != nil {
		fSelector = fieldSelector.String()
	}
	if selector.Empty() && fSelector == "" {
		log.Debug("empty selector. Fetching all settings")
	}

	lSelector := selector.String()
	cacheKey := namespace + "|" + lSelector + "|" + fSelector

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

	s.metrics.cacheMissTotal.Inc()
	invalidationsBefore := s.invalidations.Load()
	allSettings, err := s.fetch(ctx, namespace, lSelector, fSelector, span)
	if err != nil {
		oErr = err
		return nil, oErr
	}

	if s.cache != nil && s.invalidations.Load() == invalidationsBefore {
		if evicted := s.cache.Add(cacheKey, allSettings); evicted {
			s.metrics.cacheEvictionTotal.Inc()
		}
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
func (s *remoteSettingService) fetch(ctx context.Context, namespace, lSelector, fSelector string, span trace.Span) ([]*Setting, error) {
	// Pre-allocate with estimated capacity
	allSettings := make([]*Setting, 0, s.pageSize*8)
	var continueToken string
	hasNext := true
	totalPages := 0
	// Using an upper limit to prevent infinite loops
	for hasNext && totalPages < 1000 {
		totalPages++

		settings, nextToken, lErr := s.fetchPage(ctx, namespace, lSelector, fSelector, continueToken)
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

func (s *remoteSettingService) fetchPage(ctx context.Context, namespace, labelSelector, fieldSelector, continueToken string) ([]*Setting, string, error) {
	ctx, span := tracer.Start(ctx, "remoteSettingService.fetchPage")
	defer span.End()

	req := s.restClient.Get().
		Resource(resource).
		Namespace(namespace).
		Param("limit", fmt.Sprintf("%d", s.pageSize))

	if labelSelector != "" {
		req = req.Param("labelSelector", labelSelector)
	}
	if fieldSelector != "" {
		req = req.Param("fieldSelector", fieldSelector)
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

	idleConnTimeout := DefaultIdleConnTimeout
	if config.IdleConnTimeout != 0 {
		idleConnTimeout = config.IdleConnTimeout
	}

	// Wrap with tracing middleware to propagate trace context to all outbound requests
	tracingMiddleware := httpclientprovider.TracingMiddleware(logging.NewNopLogger(), tracer)
	wrapTransport := func(rt http.RoundTripper) http.RoundTripper {
		if baseTransport, ok := rt.(*http.Transport); ok && idleConnTimeout > 0 {
			baseTransport.IdleConnTimeout = idleConnTimeout
		}
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

	userAgent := fmt.Sprintf("settings-client %s (%s)", apiVersion, resolveServiceName(config))

	// Register meta types so error responses (Status) decode with their details.
	scheme := runtime.NewScheme()
	metav1.AddToGroupVersion(scheme, schema.GroupVersion{Group: "", Version: "v1"})

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

func resolveServiceName(config Config) string {
	serviceName := config.ServiceName
	if serviceName == "" {
		serviceName = os.Getenv(otelServiceNameEnvVar)
	}
	if serviceName == "" {
		serviceName = defaultServiceName
	}
	return serviceName
}

func initMetrics(serviceName string) clientMetrics {
	constLabels := prometheus.Labels{"service": serviceName}
	metrics := clientMetrics{
		listDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace:                   "settings",
				Subsystem:                   "service",
				Name:                        "list_settings_duration_seconds",
				Help:                        "Duration of remote settings service List operations",
				NativeHistogramBucketFactor: 1.1,
				Buckets:                     instrument.DefBuckets,
				ConstLabels:                 constLabels,
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
				Buckets:                     instrument.DefBuckets,
				ConstLabels:                 constLabels,
			},
		),
		rateLimiterThrottleTotal: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace:   "settings",
			Subsystem:   "service",
			Name:        "rate_limiter_throttle_total",
			Help:        "Total number of requests that waited more than 50ms due to client-side rate limiting",
			ConstLabels: constLabels,
		}),
		cacheHitTotal: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace:   "settings",
			Subsystem:   "service",
			Name:        "list_settings_cache_hit_total",
			Help:        "Total number of List cache hits",
			ConstLabels: constLabels,
		}),
		cacheMissTotal: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace:   "settings",
			Subsystem:   "service",
			Name:        "list_settings_cache_miss_total",
			Help:        "Total number of List cache misses",
			ConstLabels: constLabels,
		}),
		cacheEvictionTotal: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace:   "settings",
			Subsystem:   "service",
			Name:        "list_settings_cache_eviction_total",
			Help:        "Total number of List cache entries evicted due to capacity (CacheMaxEntries) being exceeded; use to tune cache size",
			ConstLabels: constLabels,
		}),
		cacheSize: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace:   "settings",
			Subsystem:   "service",
			Name:        "list_settings_cache_size",
			Help:        "Current number of entries in the List cache; compare against CacheMaxEntries to tune cache size",
			ConstLabels: constLabels,
		}),
		cacheMaxSize: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace:   "settings",
			Subsystem:   "service",
			Name:        "list_settings_cache_max_size",
			Help:        "Configured maximum number of entries in the List cache (CacheMaxEntries); compare against cache_size to tune cache size",
			ConstLabels: constLabels,
		}),
		cacheInvalidationTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace:   "settings",
			Subsystem:   "service",
			Name:        "list_settings_cache_invalidation_total",
			Help:        "Total number of List cache invalidations by reason: event (one namespace), reconnect or invalid_event (whole cache)",
			ConstLabels: constLabels,
		}, []string{"reason"}),
		cacheSubscribed: prometheus.NewGauge(prometheus.GaugeOpts{
			Namespace:   "settings",
			Subsystem:   "service",
			Name:        "list_settings_cache_subscribed",
			Help:        "1 when the List cache is invalidated by settings change events, 0 when it relies on TTL only",
			ConstLabels: constLabels,
		}),
	}
	return metrics
}

func (s *remoteSettingService) Describe(descs chan<- *prometheus.Desc) {
	s.metrics.listDuration.Describe(descs)
	s.metrics.listResultSize.Describe(descs)
	s.metrics.rateLimiterThrottleTotal.Describe(descs)
	s.metrics.cacheHitTotal.Describe(descs)
	s.metrics.cacheMissTotal.Describe(descs)
	s.metrics.cacheEvictionTotal.Describe(descs)
	s.metrics.cacheSize.Describe(descs)
	s.metrics.cacheMaxSize.Describe(descs)
	s.metrics.cacheInvalidationTotal.Describe(descs)
	s.metrics.cacheSubscribed.Describe(descs)
}

func (s *remoteSettingService) Collect(metrics chan<- prometheus.Metric) {
	s.metrics.listDuration.Collect(metrics)
	s.metrics.listResultSize.Collect(metrics)
	s.metrics.rateLimiterThrottleTotal.Collect(metrics)
	s.metrics.cacheHitTotal.Collect(metrics)
	s.metrics.cacheMissTotal.Collect(metrics)
	s.metrics.cacheEvictionTotal.Collect(metrics)
	if s.cache != nil {
		s.metrics.cacheSize.Set(float64(s.cache.Len()))
	}
	s.metrics.cacheSize.Collect(metrics)
	s.metrics.cacheMaxSize.Collect(metrics)
	s.metrics.cacheInvalidationTotal.Collect(metrics)
	s.metrics.cacheSubscribed.Collect(metrics)
}
