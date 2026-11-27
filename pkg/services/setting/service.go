package setting

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
	"gopkg.in/ini.v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	utilnet "k8s.io/apimachinery/pkg/util/net"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/transport"
	"k8s.io/client-go/util/flowcontrol"
	"k8s.io/client-go/util/retry"

	authlib "github.com/grafana/authlib/authn"
	"github.com/grafana/dskit/instrument"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	logging "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/util/swrcache"
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
const DefaultCacheMaxEntries = 5000
const DefaultCacheStaleWait = 100 * time.Millisecond
const DefaultCacheLoadTimeout = 30 * time.Second
const DefaultCacheMaxStale = 30 * time.Minute

// DefaultIdleConnTimeout caps how long idle keep-alive connections are pooled.
const DefaultIdleConnTimeout = 30 * time.Second

const cacheMetricsPrefix = "settings_service_list_settings_cache"

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
	fetchDuration            *prometheus.HistogramVec
	listDuration             *prometheus.HistogramVec
	listResultSize           prometheus.Histogram
	rateLimiterThrottleTotal prometheus.Counter
	cacheSize                prometheus.Gauge
	cacheMaxSize             prometheus.Gauge
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
	restClient *rest.RESTClient
	log        logging.Logger
	pageSize   int64
	metrics    clientMetrics
	cache      *swrcache.Cache[listKey, []*Setting] // nil when caching disabled
}

type listKey struct{ namespace, labelSelector, fieldSelector string }

func (k listKey) String() string {
	return k.namespace + "|" + k.labelSelector + "|" + k.fieldSelector
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
	// CacheTTL sets how long a cached List result stays fresh. Defaults to DefaultCacheTTL (5s).
	// A result older than CacheTTL is refreshed on the next read, which returns the old value
	// when the refresh takes longer than CacheStaleWait or fails. Refreshes of one result start
	// at most once per CacheTTL/2, so after a failed refresh, reads in that window get the old
	// value without a new attempt. A value is served up to CacheMaxStale old while refreshes fail.
	// Set to -1 to disable caching.
	CacheTTL time.Duration
	// CacheMaxStale is the longest a cached List result is served while refreshes fail.
	// Defaults to DefaultCacheMaxStale (30m) when zero or negative. Raised to twice CacheTTL
	// when smaller than that, which keeps a stale window after each entry stops being fresh.
	CacheMaxStale time.Duration
	// CacheMaxEntries sets the max LRU cache entries. Defaults to DefaultCacheMaxEntries (5000).
	CacheMaxEntries int
	// CacheStaleWait bounds how long a read of a stale entry waits for its refresh before it
	// returns the old value. Defaults to DefaultCacheStaleWait (100ms). Set to a negative value
	// to return the old value at once.
	CacheStaleWait time.Duration
	// CacheLoadTimeout bounds each remote fetch made for the cache, across all pages, retries and
	// rate limiter waits. It applies even after the caller stops waiting. Fetches with caching
	// disabled are bounded only by the caller's context. Defaults to DefaultCacheLoadTimeout (30s)
	// when zero or negative.
	CacheLoadTimeout time.Duration
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
	serviceName := resolveServiceName(config)
	metrics := initMetrics(serviceName)

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
	cacheMaxStale := DefaultCacheMaxStale
	if config.CacheMaxStale > 0 {
		cacheMaxStale = config.CacheMaxStale
	}
	cacheMaxEntries := DefaultCacheMaxEntries
	if config.CacheMaxEntries > 0 {
		cacheMaxEntries = config.CacheMaxEntries
	}
	cacheStaleWait := DefaultCacheStaleWait
	if config.CacheStaleWait != 0 {
		cacheStaleWait = max(config.CacheStaleWait, 0)
	}
	cacheLoadTimeout := DefaultCacheLoadTimeout
	if config.CacheLoadTimeout > 0 {
		cacheLoadTimeout = config.CacheLoadTimeout
	}

	svc := &remoteSettingService{
		restClient: restClient,
		log:        log,
		pageSize:   pageSize,
		metrics:    metrics,
	}

	if config.CacheTTL >= 0 {
		svc.cache, err = swrcache.New(svc.load, swrcache.Options{
			MetricsPrefix:      cacheMetricsPrefix,
			ConstLabels:        prometheus.Labels{"service": serviceName},
			TTL:                max(cacheMaxStale, 2*cacheTTL),
			RefreshInterval:    cacheTTL,
			MinRefreshInterval: cacheTTL / 2,
			StaleWait:          cacheStaleWait,
			LoadTimeout:        cacheLoadTimeout,
			MaxEntries:         cacheMaxEntries,
			Logger:             log,
			Tracer:             tracer,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create list cache: %w", err)
		}
		metrics.cacheMaxSize.Set(float64(cacheMaxEntries))
	}

	return svc, nil
}

// load is the cache loader. It must depend on key only, because one load serves every caller.
func (s *remoteSettingService) load(ctx context.Context, key listKey) ([]*Setting, error) {
	start := time.Now()
	settings, err := s.fetch(ctx, key.namespace, key.labelSelector, key.fieldSelector)
	observeDuration(s.metrics.fetchDuration, start, err)
	return settings, err
}

func observeDuration(histogram *prometheus.HistogramVec, start time.Time, err error) {
	status := "success"
	if err != nil {
		status = "error"
	}
	histogram.WithLabelValues(status).Observe(time.Since(start).Seconds())
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

func (s *remoteSettingService) ListWithFieldSelector(ctx context.Context, labelSelector metav1.LabelSelector, fieldSelector fields.Selector) ([]*Setting, error) {
	start := time.Now()
	settings, err := s.listWithFieldSelector(ctx, labelSelector, fieldSelector)
	observeDuration(s.metrics.listDuration, start, err)
	return settings, err
}

func (s *remoteSettingService) listWithFieldSelector(ctx context.Context, labelSelector metav1.LabelSelector, fieldSelector fields.Selector) ([]*Setting, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	ns := attribute.String("grafana.namespace.name", namespace)
	ctx, span := tracer.Start(ctx, "remoteSettingService.List",
		trace.WithAttributes(ns))
	defer span.End()

	if !ok || namespace == "" {
		return nil, tracing.Errorf(span, "missing namespace in context")
	}
	log := s.log.FromContext(ctx).New(ns.Key, ns.Value, "function", "remoteSettingService.List", "traceId", span.SpanContext().TraceID())

	selector, err := metav1.LabelSelectorAsSelector(&labelSelector)
	if err != nil {
		return nil, tracing.Error(span, err)
	}
	fSelector := ""
	if fieldSelector != nil {
		fSelector = fieldSelector.String()
	}
	if selector.Empty() && fSelector == "" {
		log.Debug("empty selector. Fetching all settings")
	}

	key := listKey{namespace: namespace, labelSelector: selector.String(), fieldSelector: fSelector}
	var settings []*Setting
	if s.cache == nil {
		settings, err = s.load(ctx, key)
	} else {
		settings, err = s.cache.Get(ctx, key)
	}
	if err != nil {
		return nil, tracing.Error(span, err)
	}
	return settings, nil
}

// fetch retrieves all settings from the remote service using paginated requests.
func (s *remoteSettingService) fetch(ctx context.Context, namespace, lSelector, fSelector string) ([]*Setting, error) {
	allSettings := make([]*Setting, 0)
	var continueToken string
	hasNext := true
	totalPages := 0
	// Using an upper limit to prevent infinite loops
	for hasNext && totalPages < 1000 {
		totalPages++

		settings, nextToken, lErr := s.fetchPage(ctx, namespace, lSelector, fSelector, continueToken)
		if lErr != nil {
			return nil, lErr
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

	var settings []*Setting
	var nextToken string
	attempt := 0
	var lastErr error
	err := retry.OnError(retry.DefaultBackoff, isTransientConnError, func() error {
		attempt++
		if lastErr != nil {
			s.log.FromContext(ctx).Warn("Retrying settings page fetch after transient connection error",
				"grafana.namespace.name", namespace, "attempt", attempt, "error", lastErr)
			span.AddEvent("retry", trace.WithAttributes(
				attribute.Int("attempt", attempt), attribute.String("error", lastErr.Error())))
		}
		settings, nextToken, lastErr = streamPage(ctx, req)
		return lastErr
	})
	if err != nil {
		return nil, "", err
	}
	return settings, nextToken, nil
}

func streamPage(ctx context.Context, req *rest.Request) ([]*Setting, string, error) {
	stream, err := req.Stream(ctx)
	if err != nil {
		return nil, "", fmt.Errorf("request failed: %w", err)
	}
	defer func() { _ = stream.Close() }()

	return parseSettingList(ctx, stream)
}

// isTransientConnError matches the GET errors that client-go retries in Request.Do but not in
// Request.Stream. It also matches a connection that drops while the body streams, and a
// refused connection (e.g. a pod that is shutting down), which Request.Do does not retry.
func isTransientConnError(err error) bool {
	return utilnet.IsConnectionReset(err) || utilnet.IsProbableEOF(err) ||
		utilnet.IsHTTP2ConnectionLost(err) || utilnet.IsConnectionRefused(err) ||
		errors.Is(err, io.ErrUnexpectedEOF)
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
		fetchDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace:                   "settings",
				Subsystem:                   "service",
				Name:                        "list_settings_fetch_duration_seconds",
				Help:                        "Duration of remote settings service List fetches, including background cache refreshes",
				NativeHistogramBucketFactor: 1.1,
				Buckets:                     instrument.DefBuckets,
				ConstLabels:                 constLabels,
			},
			[]string{"status"}, // status: "success" or "error"
		),
		listDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace:                   "settings",
				Subsystem:                   "service",
				Name:                        "list_settings_duration_seconds",
				Help:                        "Time List callers wait for a result, including cache hits and stale values",
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
	}
	return metrics
}

func (s *remoteSettingService) Describe(descs chan<- *prometheus.Desc) {
	s.metrics.fetchDuration.Describe(descs)
	s.metrics.listDuration.Describe(descs)
	s.metrics.listResultSize.Describe(descs)
	s.metrics.rateLimiterThrottleTotal.Describe(descs)
	s.metrics.cacheSize.Describe(descs)
	s.metrics.cacheMaxSize.Describe(descs)
	if s.cache != nil {
		s.cache.Describe(descs)
	}
}

func (s *remoteSettingService) Collect(metrics chan<- prometheus.Metric) {
	s.metrics.fetchDuration.Collect(metrics)
	s.metrics.listDuration.Collect(metrics)
	s.metrics.listResultSize.Collect(metrics)
	s.metrics.rateLimiterThrottleTotal.Collect(metrics)
	if s.cache != nil {
		s.metrics.cacheSize.Set(float64(s.cache.Len()))
	}
	s.metrics.cacheSize.Collect(metrics)
	s.metrics.cacheMaxSize.Collect(metrics)
	if s.cache != nil {
		s.cache.Collect(metrics)
	}
}
