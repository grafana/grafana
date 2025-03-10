package resource

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
)

type groupResource map[string]map[string]interface{}

const (
	metricsNamespace = "grafana"
	metricsSubSystem = "grpc_authz_limited_client"
)

var metOnce sync.Once

type accessMetrics struct {
	checkDuration   *prometheus.HistogramVec
	compileDuration *prometheus.HistogramVec
	errorsTotal     *prometheus.CounterVec
}

func newMetrics(reg prometheus.Registerer) *accessMetrics {
	m := &accessMetrics{
		checkDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "check_duration_seconds",
				Help:      "duration of the access check calls going through the authz service",
			}, []string{"group", "resource", "verb", "allowed"}),
		compileDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "compile_duration_seconds",
				Help:      "duration of the access compile calls going through the authz service",
			}, []string{"group", "resource", "verb"}),
		errorsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "errors_total",
				Help:      "Number of errors",
			}, []string{"group", "resource", "verb"}),
	}

	if reg != nil {
		metOnce.Do(func() {
			reg.MustRegister(m.checkDuration)
			reg.MustRegister(m.compileDuration)
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
	client claims.AccessClient
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
func NewAuthzLimitedClient(client claims.AccessClient, opts AuthzOptions) claims.AccessClient {
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

// Check implements claims.AccessClient.
func (c authzLimitedClient) Check(ctx context.Context, id claims.AuthInfo, req claims.CheckRequest) (claims.CheckResponse, error) {
	t := time.Now()
	ctx, span := c.tracer.Start(ctx, "authzLimitedClient.Check", trace.WithAttributes(
		attribute.String("group", req.Group),
		attribute.String("resource", req.Resource),
		attribute.String("namespace", req.Namespace),
		attribute.String("name", req.Name),
		attribute.String("verb", req.Verb),
		attribute.String("folder", req.Folder),
		attribute.Bool("fallback_used", grpcutils.FallbackUsed(ctx)),
	))
	defer span.End()
	if grpcutils.FallbackUsed(ctx) {
		span.SetAttributes(attribute.Bool("allowed", true))
		return claims.CheckResponse{Allowed: true}, nil
	}
	if !c.IsCompatibleWithRBAC(req.Group, req.Resource) {
		span.SetAttributes(attribute.Bool("allowed", true))
		return claims.CheckResponse{Allowed: true}, nil
	}
	resp, err := c.client.Check(ctx, id, req)
	if err != nil {
		c.logger.Error("Check", "group", req.Group, "resource", req.Resource, "error", err, "duration", time.Since(t), "traceid", tracing.TraceIDFromContext(ctx, false))
		c.metrics.errorsTotal.WithLabelValues(req.Group, req.Resource, req.Verb).Inc()
		span.SetAttributes(attribute.String("error", err.Error()))
		return resp, err
	}
	span.SetAttributes(attribute.Bool("allowed", resp.Allowed))
	c.metrics.checkDuration.WithLabelValues(req.Group, req.Resource, req.Verb, fmt.Sprintf("%t", resp.Allowed)).Observe(time.Since(t).Seconds())
	return resp, nil
}

// Compile implements claims.AccessClient.
func (c authzLimitedClient) Compile(ctx context.Context, id claims.AuthInfo, req claims.ListRequest) (claims.ItemChecker, error) {
	t := time.Now()
	fallbackUsed := grpcutils.FallbackUsed(ctx)
	ctx, span := c.tracer.Start(ctx, "authzLimitedClient.Compile", trace.WithAttributes(
		attribute.String("group", req.Group),
		attribute.String("resource", req.Resource),
		attribute.String("namespace", req.Namespace),
		attribute.String("verb", req.Verb),
		attribute.Bool("fallback_used", fallbackUsed),
	))
	defer span.End()
	if fallbackUsed || !c.IsCompatibleWithRBAC(req.Group, req.Resource) {
		return func(name, folder string) bool {
			return true
		}, nil
	}
	checker, err := c.client.Compile(ctx, id, req)
	if err != nil {
		c.logger.Error("Compile", "group", req.Group, "resource", req.Resource, "error", err, "traceid", tracing.TraceIDFromContext(ctx, false))
		c.metrics.errorsTotal.WithLabelValues(req.Group, req.Resource, req.Verb).Inc()
		span.SetAttributes(attribute.String("error", err.Error()))
		return nil, err
	}
	c.metrics.compileDuration.WithLabelValues(req.Group, req.Resource, req.Verb).Observe(time.Since(t).Seconds())
	return checker, nil
}

func (c authzLimitedClient) IsCompatibleWithRBAC(group, resource string) bool {
	if _, ok := c.allowlist[group]; ok {
		if _, ok := c.allowlist[group][resource]; ok {
			return true
		}
	}
	return false
}

var _ claims.AccessClient = &authzLimitedClient{}
