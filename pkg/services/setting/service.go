package setting

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"gopkg.in/ini.v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	utilnet "k8s.io/apimachinery/pkg/util/net"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/dynamic"
	clientrest "k8s.io/client-go/rest"
	"k8s.io/client-go/transport"

	authlib "github.com/grafana/authlib/authn"
	logging "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/semconv"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/setting")

const LogPrefix = "setting.service"

const DefaultPageSize = int64(500)
const DefaultQPS = float32(10)
const DefaultBurst = 25

const (
	ApiGroup   = "setting.grafana.app"
	apiVersion = "v0alpha1"
	resource   = "settings"
	kind       = "Setting"
	listKind   = "SettingList"
)

var settingGroupVersion = schema.GroupVersionResource{
	Group:    ApiGroup,
	Version:  apiVersion,
	Resource: resource,
}

var settingGroupListKind = map[schema.GroupVersionResource]string{
	settingGroupVersion: listKind,
}

type remoteSettingServiceMetrics struct {
	listDuration   *prometheus.HistogramVec
	listResultSize *prometheus.HistogramVec
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
	dynamicClient dynamic.Interface
	log           logging.Logger
	pageSize      int64
	metrics       remoteSettingServiceMetrics
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
	TLSClientConfig clientrest.TLSClientConfig
	// QPS limits requests per second (defaults to DefaultQPS).
	QPS float32
	// Burst allows request bursts above QPS (defaults to DefaultBurst).
	Burst int
	// PageSize sets the number of items per API page (defaults to DefaultPageSize).
	PageSize int64
}

// Setting represents the parsed spec of a Setting resource.
type Setting struct {
	// Setting section
	Section string `json:"section"`
	// Setting key
	Key string `json:"key"`
	// Setting value
	Value string `json:"value"`
}

// New creates a Service from the provided configuration.
func New(config Config) (Service, error) {
	log := logging.New(LogPrefix)
	dynamicClient, err := getDynamicClient(config, log)
	if err != nil {
		return nil, err
	}
	pageSize := DefaultPageSize
	if config.PageSize > 0 {
		pageSize = config.PageSize
	}

	metrics := initMetrics()

	return &remoteSettingService{
		dynamicClient: dynamicClient,
		pageSize:      pageSize,
		log:           log,
		metrics:       metrics,
	}, nil
}

func (m *remoteSettingService) ListAsIni(ctx context.Context, labelSelector metav1.LabelSelector) (*ini.File, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	ns := semconv.GrafanaNamespaceName(namespace)
	ctx, span := tracer.Start(ctx, "remoteSettingService.ListAsIni",
		trace.WithAttributes(ns))
	defer span.End()

	if !ok || namespace == "" {
		return nil, tracing.Errorf(span, "missing namespace in context")
	}

	settings, err := m.List(ctx, labelSelector)
	if err != nil {
		return nil, err
	}
	iniFile, err := m.toIni(settings)
	if err != nil {
		return nil, tracing.Error(span, err)
	}
	return iniFile, nil
}

func (m *remoteSettingService) List(ctx context.Context, labelSelector metav1.LabelSelector) ([]*Setting, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	ns := semconv.GrafanaNamespaceName(namespace)
	ctx, span := tracer.Start(ctx, "remoteSettingService.List",
		trace.WithAttributes(ns))
	defer span.End()
	if !ok || namespace == "" {
		return nil, tracing.Errorf(span, "missing namespace in context")
	}
	log := m.log.FromContext(ctx).New(ns.Key, ns.Value, "function", "remoteSettingService.List", "traceId", span.SpanContext().TraceID())

	startTime := time.Now()
	var status string
	defer func() {
		duration := time.Since(startTime).Seconds()
		m.metrics.listDuration.WithLabelValues(status).Observe(duration)
	}()

	selector, err := metav1.LabelSelectorAsSelector(&labelSelector)
	if err != nil {
		status = "error"
		return nil, tracing.Error(span, err)
	}
	if selector.Empty() {
		log.Debug("empty selector. Fetching all settings")
	}

	var allSettings []*Setting
	var continueToken string
	hasNext := true
	totalPages := 0
	// Using an upper limit to prevent infinite loops
	for hasNext && totalPages < 1000 {
		totalPages++
		opts := metav1.ListOptions{
			Limit:    m.pageSize,
			Continue: continueToken,
		}
		if !selector.Empty() {
			opts.LabelSelector = selector.String()
		}

		settingsList, lErr := m.dynamicClient.Resource(settingGroupVersion).Namespace(namespace).List(ctx, opts)
		if lErr != nil {
			status = "error"
			return nil, tracing.Error(span, lErr)
		}
		for i := range settingsList.Items {
			setting, pErr := parseSettingResource(&settingsList.Items[i])
			if pErr != nil {
				status = "error"
				return nil, tracing.Error(span, pErr)
			}
			allSettings = append(allSettings, setting)
		}
		continueToken = settingsList.GetContinue()
		if continueToken == "" {
			hasNext = false
		}
	}

	status = "success"
	m.metrics.listResultSize.WithLabelValues(status).Observe(float64(len(allSettings)))

	return allSettings, nil
}

func parseSettingResource(setting *unstructured.Unstructured) (*Setting, error) {
	spec, found, err := unstructured.NestedMap(setting.Object, "spec")
	if err != nil {
		return nil, fmt.Errorf("failed to get spec from setting: %w", err)
	}
	if !found {
		return nil, fmt.Errorf("spec not found in setting %s", setting.GetName())
	}

	var result Setting
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(spec, &result); err != nil {
		return nil, fmt.Errorf("failed to convert spec to Setting: %w", err)
	}

	return &result, nil
}

func (m *remoteSettingService) toIni(settings []*Setting) (*ini.File, error) {
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

func getDynamicClient(config Config, log logging.Logger) (dynamic.Interface, error) {
	if config.URL == "" {
		return nil, fmt.Errorf("URL cannot be empty")
	}
	if config.WrapTransport == nil && config.TokenExchangeClient == nil {
		return nil, fmt.Errorf("must set either TokenExchangeClient or WrapTransport")
	}

	wrapTransport := config.WrapTransport
	if config.WrapTransport == nil {
		log.Debug("using default wrapTransport with TokenExchangeClient")
		wrapTransport = func(rt http.RoundTripper) http.RoundTripper {
			return &authRoundTripper{
				tokenClient: config.TokenExchangeClient,
				transport:   rt,
			}
		}
	}

	qps := DefaultQPS
	if config.QPS > 0 {
		qps = config.QPS
	}

	burst := DefaultBurst
	if config.Burst > 0 {
		burst = config.Burst
	}

	return dynamic.NewForConfig(&clientrest.Config{
		Host:            config.URL,
		WrapTransport:   wrapTransport,
		TLSClientConfig: config.TLSClientConfig,
		QPS:             qps,
		Burst:           burst,
	})
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
	req = utilnet.CloneRequest(req)

	req.Header.Set("X-Access-Token", fmt.Sprintf("Bearer %s", token.Token))
	return a.transport.RoundTrip(req)
}

func initMetrics() remoteSettingServiceMetrics {
	metrics := remoteSettingServiceMetrics{
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
		listResultSize: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace:                   "settings",
				Subsystem:                   "service",
				Name:                        "list_settings_result_size",
				Help:                        "Number of settings returned by remote settings service List operations",
				NativeHistogramBucketFactor: 1.1,
			},
			[]string{"status"}, // status: "success" or "error"
		),
	}
	return metrics
}

func (m *remoteSettingService) Describe(descs chan<- *prometheus.Desc) {
	m.metrics.listDuration.Describe(descs)
	m.metrics.listResultSize.Describe(descs)
}

func (m *remoteSettingService) Collect(metrics chan<- prometheus.Metric) {
	m.metrics.listDuration.Collect(metrics)
	m.metrics.listResultSize.Collect(metrics)
}
