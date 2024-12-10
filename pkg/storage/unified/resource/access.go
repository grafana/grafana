package resource

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
)

type staticAuthzClient struct {
	allowed bool
}

// Check implements authz.AccessClient.
func (c *staticAuthzClient) Check(ctx context.Context, id claims.AuthInfo, req authz.CheckRequest) (authz.CheckResponse, error) {
	return authz.CheckResponse{Allowed: c.allowed}, nil
}

// Compile implements authz.AccessClient.
func (c *staticAuthzClient) Compile(ctx context.Context, id claims.AuthInfo, req authz.ListRequest) (authz.ItemChecker, error) {
	return func(namespace string, name, folder string) bool {
		return c.allowed
	}, nil
}

var _ authz.AccessClient = &staticAuthzClient{}

type groupResource map[string]map[string]interface{}

const (
	metricsNamespace = "grafana"
	metricsSubSystem = "grpc_authz_limited_client"
)

var metOnce sync.Once

type accessMetrics struct {
	checksDuration *prometheus.HistogramVec
	errorsTotal    *prometheus.CounterVec
}

func newMetrics(reg prometheus.Registerer) *accessMetrics {
	m := &accessMetrics{
		checksDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "requests_total",
				Help:      "Number requests using the authenticator with fallback",
			}, []string{"resource", "group", "fallback_used", "allowed"}),
		errorsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "errors_total",
				Help:      "Number of errors",
			}, []string{"resource", "group"}),
	}

	if reg != nil {
		metOnce.Do(func() {
			reg.MustRegister(m.checksDuration)
			reg.MustRegister(m.errorsTotal)
		})
	}

	return m
}

// authzLimitedClient is a client that enforces RBAC for the limited number of groups and resources.
// This is a temporary solution until the authz service is fully implemented.
// The authz service will be responsible for enforcing RBAC.
// For now, it makes one call to the authz service for each list items. This is known to be inefficient.
type authzLimitedClient struct {
	client authz.AccessChecker
	// allowlist is a map of group to resources that are compatible with RBAC.
	allowlist groupResource
	logger    *slog.Logger
	tracer    trace.Tracer
	metrics   *accessMetrics
}

type AuthzOptions struct {
	Tracer   trace.Tracer
	Registry prometheus.Registerer
}

// NewAuthzLimitedClient creates a new authzLimitedClient.
func NewAuthzLimitedClient(client authz.AccessChecker, opts AuthzOptions) authz.AccessClient {
	logger := slog.Default().With("logger", "limited-authz-client")
	if opts.Tracer == nil {
		opts.Tracer = noop.NewTracerProvider().Tracer("limited-authz-client")
	}
	if opts.Registry == nil {
		opts.Registry = prometheus.DefaultRegisterer
	}
	return &authzLimitedClient{
		client: client,
		allowlist: groupResource{
			"dashboard.grafana.app": map[string]interface{}{"dashboards": nil},
			"folder.grafana.app":    map[string]interface{}{"folders": nil},
		},
		logger:  logger,
		tracer:  opts.Tracer,
		metrics: newMetrics(opts.Registry),
	}
}

// Check implements authz.AccessClient.
func (c authzLimitedClient) Check(ctx context.Context, id claims.AuthInfo, req authz.CheckRequest) (authz.CheckResponse, error) {
	t := time.Now()
	ctx, span := c.tracer.Start(ctx, "authzLimitedClient.Check", trace.WithAttributes(
		attribute.String("group", req.Group),
		attribute.String("resource", req.Resource),
		attribute.Bool("fallback", grpcutils.FallbackUsed(ctx)),
	))
	defer span.End()
	if grpcutils.FallbackUsed(ctx) {
		c.metrics.checksDuration.WithLabelValues(req.Resource, req.Group, "true", "true").Observe(time.Since(t).Seconds())
		return authz.CheckResponse{Allowed: true}, nil
	}
	if !c.IsCompatibleWithRBAC(req.Group, req.Resource) {
		c.metrics.checksDuration.WithLabelValues(req.Resource, req.Group, "false", "true").Observe(time.Since(t).Seconds())
		return authz.CheckResponse{Allowed: true}, nil
	}
	resp, err := c.client.Check(ctx, id, req)
	if err != nil {
		c.logger.Error("Check", "group", req.Group, "resource", req.Resource, "error", err, "duration", time.Since(t), "traceid", tracing.TraceIDFromContext(ctx, false))
		c.metrics.errorsTotal.WithLabelValues(req.Resource, req.Group).Inc()
		return resp, err
	}
	c.metrics.checksDuration.WithLabelValues(req.Resource, req.Group, "false", fmt.Sprintf("%t", resp.Allowed)).Observe(time.Since(t).Seconds())
	return resp, nil
}

// Compile implements authz.AccessClient.
func (c authzLimitedClient) Compile(ctx context.Context, id claims.AuthInfo, req authz.ListRequest) (authz.ItemChecker, error) {
	ctx, span := c.tracer.Start(ctx, "authzLimitedClient.Compile", trace.WithAttributes(
		attribute.String("group", req.Group),
		attribute.String("resource", req.Resource),
	))
	defer span.End()
	return func(namespace string, name, folder string) bool {
		t := time.Now()
		ctx, span := c.tracer.Start(ctx, "authzLimitedClient.Compile.Check", trace.WithAttributes(
			attribute.String("group", req.Group),
			attribute.String("resource", req.Resource),
			attribute.Bool("fallback", grpcutils.FallbackUsed(ctx)),
		))
		defer span.End()
		if grpcutils.FallbackUsed(ctx) {
			c.metrics.checksDuration.WithLabelValues(req.Resource, req.Group, "true", "true").Observe(time.Since(t).Seconds())
			return true
		}
		if !c.IsCompatibleWithRBAC(req.Group, req.Resource) {
			c.metrics.checksDuration.WithLabelValues(req.Resource, req.Group, "true", "true").Observe(time.Since(t).Seconds())
			return true
		}
		r, err := c.client.Check(ctx, id, authz.CheckRequest{
			Verb:      "get",
			Group:     req.Group,
			Resource:  req.Resource,
			Namespace: namespace,
			Name:      name,
			Folder:    folder,
		})
		if err != nil {
			c.metrics.errorsTotal.WithLabelValues(req.Resource, req.Group).Inc()
			c.logger.Error("Compile.Check", "group", req.Group, "resource", req.Resource, "namespace", namespace, "name", name, "folder", folder, "error", err, "duration", time.Since(t), "traceid", tracing.TraceIDFromContext(ctx, false))
			return false
		}
		c.metrics.checksDuration.WithLabelValues(req.Resource, req.Group, "false", fmt.Sprintf("%t", r.Allowed)).Observe(time.Since(t).Seconds())
		return r.Allowed
	}, nil
}

func (c authzLimitedClient) IsCompatibleWithRBAC(group, resource string) bool {
	if _, ok := c.allowlist[group]; ok {
		if _, ok := c.allowlist[group][resource]; ok {
			return true
		}
	}
	return false
}

var _ authz.AccessClient = &authzLimitedClient{}
