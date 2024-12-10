package resource

import (
	"context"
	"log/slog"
	"time"

	"github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
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
}

type AuthzOptions struct {
	Tracer trace.Tracer
}

// NewAuthzLimitedClient creates a new authzLimitedClient.
func NewAuthzLimitedClient(client authz.AccessChecker, opts AuthzOptions) authz.AccessClient {
	logger := slog.Default().With("logger", "limited-authz-client")
	if opts.Tracer == nil {
		opts.Tracer = noop.NewTracerProvider().Tracer("limited-authz-client")
	}
	return &authzLimitedClient{
		client: client,
		allowlist: groupResource{
			"dashboard.grafana.app": map[string]interface{}{"dashboards": nil},
			"folder.grafana.app":    map[string]interface{}{"folders": nil},
		},
		logger: logger,
		tracer: opts.Tracer,
	}
}

// Check implements authz.AccessClient.
func (c authzLimitedClient) Check(ctx context.Context, id claims.AuthInfo, req authz.CheckRequest) (authz.CheckResponse, error) {
	ctx, span := c.tracer.Start(ctx, "authzLimitedClient.Check", trace.WithAttributes(
		attribute.String("group", req.Group),
		attribute.String("resource", req.Resource),
		attribute.Bool("fallback", grpcutils.FallbackUsed(ctx)),
	))
	defer span.End()
	if grpcutils.FallbackUsed(ctx) {
		c.logger.Debug("Check", "group", req.Group, "resource", req.Resource, "fallback", true, "rbac", false, "allowed", true)
		return authz.CheckResponse{Allowed: true}, nil
	}
	if !c.IsCompatibleWithRBAC(req.Group, req.Resource) {
		c.logger.Debug("Check", "group", req.Group, "resource", req.Resource, "fallback", false, "rbac", false, "allowed", true)
		return authz.CheckResponse{Allowed: true}, nil
	}
	t := time.Now()
	resp, err := c.client.Check(ctx, id, req)
	if err != nil {
		c.logger.Error("Check", "group", req.Group, "resource", req.Resource, "fallback", false, "rbac", true, "error", err, "duration", time.Since(t))
		return resp, err
	}
	c.logger.Debug("Check", "group", req.Group, "resource", req.Resource, "fallback", false, "rbac", true, "allowed", resp.Allowed, "duration", time.Since(t))
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
		ctx, span := c.tracer.Start(ctx, "authzLimitedClient.Compile.Check", trace.WithAttributes(
			attribute.String("group", req.Group),
			attribute.String("resource", req.Resource),
			attribute.Bool("fallback", grpcutils.FallbackUsed(ctx)),
		))
		defer span.End()
		if grpcutils.FallbackUsed(ctx) {
			c.logger.Debug("Compile.Check", "group", req.Group, "resource", req.Resource, "fallback", true, "rbac", false, "allowed", true)
			return true
		}
		// TODO: Implement For now we perform the check for each item.
		if !c.IsCompatibleWithRBAC(req.Group, req.Resource) {
			c.logger.Debug("Compile.Check", "group", req.Group, "resource", req.Resource, "namespace", namespace, "name", name, "folder", folder, "fallback", false, "rbac", false, "allowed", true)
			return true
		}
		t := time.Now()
		r, err := c.client.Check(ctx, id, authz.CheckRequest{
			Verb:      "get",
			Group:     req.Group,
			Resource:  req.Resource,
			Namespace: namespace,
			Name:      name,
			Folder:    folder,
		})
		if err != nil {
			c.logger.Error("Compile.Check", "group", req.Group, "resource", req.Resource, "namespace", namespace, "name", name, "folder", folder, "fallback", false, "rbac", true, "error", err, "duration", time.Since(t))
			return false
		}
		c.logger.Debug("Compile.Check", "group", req.Group, "resource", req.Resource, "namespace", namespace, "name", name, "folder", folder, "fallback", false, "rbac", true, "allowed", r.Allowed, "duration", time.Since(t))
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
