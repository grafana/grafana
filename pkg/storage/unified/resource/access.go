package resource

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/log"
)

type groupResource map[string]map[string]interface{}

const (
	metricsNamespace = "grafana"
	metricsSubSystem = "grpc_authz_limited_client"
)

var metOnce sync.Once

type accessMetrics struct {
	checkDuration      *prometheus.HistogramVec
	compileDuration    *prometheus.HistogramVec
	batchCheckDuration *prometheus.HistogramVec
	errorsTotal        *prometheus.CounterVec
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
		batchCheckDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: metricsNamespace,
				Subsystem: metricsSubSystem,
				Name:      "batch_check_duration_seconds",
				Help:      "duration of the batch access check calls going through the authz service",
			}, []string{"check_count"}),
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
			reg.MustRegister(m.batchCheckDuration)
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
	logger    log.Logger
	metrics   *accessMetrics
}

type AuthzOptions struct {
	Registry prometheus.Registerer
}

// NewAuthzLimitedClient creates a new authzLimitedClient.
func NewAuthzLimitedClient(client claims.AccessClient, opts AuthzOptions) claims.AccessClient {
	logger := log.New("limited-authz-client")
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
		metrics: newMetrics(opts.Registry),
	}
}

// Check implements claims.AccessClient.
func (c authzLimitedClient) Check(ctx context.Context, id claims.AuthInfo, req claims.CheckRequest, folder string) (claims.CheckResponse, error) {
	t := time.Now()
	ctx, span := tracer.Start(ctx, "resource.authzLimitedClient.Check", trace.WithAttributes(
		attribute.String("group", req.Group),
		attribute.String("resource", req.Resource),
		attribute.String("namespace", req.Namespace),
		attribute.String("name", req.Name),
		attribute.String("verb", req.Verb),
		attribute.String("folder", folder),
	))
	defer span.End()

	if !claims.NamespaceMatches(id.GetNamespace(), req.Namespace) {
		span.SetAttributes(attribute.Bool("allowed", false))
		span.SetStatus(codes.Error, "Namespace mismatch")
		span.RecordError(claims.ErrNamespaceMismatch)
		return claims.CheckResponse{Allowed: false}, claims.ErrNamespaceMismatch
	}

	if !c.IsCompatibleWithRBAC(req.Group, req.Resource) {
		span.SetAttributes(attribute.Bool("allowed", true))
		return claims.CheckResponse{Allowed: true}, nil
	}
	resp, err := c.client.Check(ctx, id, req, folder)
	if err != nil {
		c.logger.FromContext(ctx).Error("Check", "group", req.Group, "resource", req.Resource, "error", err, "duration", time.Since(t))
		c.metrics.errorsTotal.WithLabelValues(req.Group, req.Resource, req.Verb).Inc()
		span.SetStatus(codes.Error, fmt.Sprintf("check failed: %v", err))
		span.RecordError(err)
		return resp, err
	}
	span.SetAttributes(attribute.Bool("allowed", resp.Allowed))
	c.metrics.checkDuration.WithLabelValues(req.Group, req.Resource, req.Verb, fmt.Sprintf("%t", resp.Allowed)).Observe(time.Since(t).Seconds())
	return resp, nil
}

// Compile implements claims.AccessClient.
func (c authzLimitedClient) Compile(ctx context.Context, id claims.AuthInfo, req claims.ListRequest) (claims.ItemChecker, claims.Zookie, error) {
	t := time.Now()
	ctx, span := tracer.Start(ctx, "resource.authzLimitedClient.Compile", trace.WithAttributes(
		attribute.String("group", req.Group),
		attribute.String("resource", req.Resource),
		attribute.String("namespace", req.Namespace),
		attribute.String("verb", req.Verb),
	))
	defer span.End()

	if !claims.NamespaceMatches(id.GetNamespace(), req.Namespace) {
		span.SetAttributes(attribute.Bool("allowed", false))
		span.SetStatus(codes.Error, "Namespace mismatch")
		span.RecordError(claims.ErrNamespaceMismatch)
		return nil, claims.NoopZookie{}, claims.ErrNamespaceMismatch
	}

	if !c.IsCompatibleWithRBAC(req.Group, req.Resource) {
		return func(name, folder string) bool {
			return true
		}, claims.NoopZookie{}, nil
	}
	//nolint:staticcheck // SA1019: Compile is deprecated but BatchCheck is not yet fully implemented
	checker, zookie, err := c.client.Compile(ctx, id, req)
	if err != nil {
		c.logger.FromContext(ctx).Error("Compile", "group", req.Group, "resource", req.Resource, "error", err)
		c.metrics.errorsTotal.WithLabelValues(req.Group, req.Resource, req.Verb).Inc()
		span.SetStatus(codes.Error, fmt.Sprintf("compile failed: %v", err))
		span.RecordError(err)
		return nil, zookie, err
	}
	c.metrics.compileDuration.WithLabelValues(req.Group, req.Resource, req.Verb).Observe(time.Since(t).Seconds())
	return checker, zookie, nil
}

func (c authzLimitedClient) IsCompatibleWithRBAC(group, resource string) bool {
	if _, ok := c.allowlist[group]; ok {
		if _, ok := c.allowlist[group][resource]; ok {
			return true
		}
	}
	return false
}

func (c authzLimitedClient) BatchCheck(ctx context.Context, id claims.AuthInfo, req claims.BatchCheckRequest) (claims.BatchCheckResponse, error) {
	t := time.Now()
	ctx, span := tracer.Start(ctx, "resource.authzLimitedClient.BatchCheck", trace.WithAttributes(
		attribute.String("namespace", req.Namespace),
		attribute.String("subject", id.GetSubject()),
		attribute.Int("check_count", len(req.Checks)),
	))
	defer span.End()

	results := make(map[string]claims.BatchCheckResult, len(req.Checks))

	// Validate namespace matches
	if !claims.NamespaceMatches(id.GetNamespace(), req.Namespace) {
		span.SetStatus(codes.Error, "Namespace mismatch")
		span.RecordError(claims.ErrNamespaceMismatch)
		return claims.BatchCheckResponse{}, claims.ErrNamespaceMismatch
	}

	// Build a separate request for items that need to be checked by the underlying client
	var itemsToCheck []claims.BatchCheckItem
	for _, item := range req.Checks {
		if !c.IsCompatibleWithRBAC(item.Group, item.Resource) {
			// Not compatible with RBAC, allow by default
			results[item.CorrelationID] = claims.BatchCheckResult{Allowed: true}
		} else {
			// Will be checked by underlying client
			itemsToCheck = append(itemsToCheck, item)
		}
	}

	// If all items were allowed by default, return early
	if len(itemsToCheck) == 0 {
		return claims.BatchCheckResponse{Results: results}, nil
	}

	// Forward to the underlying client
	batchReq := claims.BatchCheckRequest{
		Namespace: req.Namespace,
		Checks:    itemsToCheck,
		SkipCache: req.SkipCache,
	}
	resp, err := c.client.BatchCheck(ctx, id, batchReq)
	if err != nil {
		c.logger.FromContext(ctx).Error("BatchCheck", "error", err, "duration", time.Since(t))
		c.metrics.errorsTotal.WithLabelValues("", "", "batch_check").Inc()
		span.SetStatus(codes.Error, fmt.Sprintf("batch check failed: %v", err))
		span.RecordError(err)
		return claims.BatchCheckResponse{}, err
	}

	// Merge results from underlying client
	for correlationID, result := range resp.Results {
		results[correlationID] = result
	}

	c.metrics.batchCheckDuration.WithLabelValues(fmt.Sprintf("%d", len(req.Checks))).Observe(time.Since(t).Seconds())
	return claims.BatchCheckResponse{Results: results}, nil
}

var _ claims.AccessClient = &authzLimitedClient{}
