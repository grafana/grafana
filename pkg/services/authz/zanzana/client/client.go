package client

import (
	"context"
	"time"

	"go.opentelemetry.io/otel"
	"google.golang.org/grpc"
	"google.golang.org/grpc/status"

	authzlib "github.com/grafana/authlib/authz"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/cache"
	authlib "github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

var _ authlib.AccessClient = (*Client)(nil)
var _ zanzana.Client = (*Client)(nil)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/authz/zanzana/client")

type Client struct {
	logger          log.Logger
	authz           authzv1.AuthzServiceClient
	authzext        authzextv1.AuthzExtentionServiceClient
	authzlibclient  *authzlib.ClientImpl
	snapshotClient  *authzlib.ClientImpl
	snapshotTimeout time.Duration
	metrics         *clientMetrics
}

type ClientOption func(*Client)

func WithUserPermissionsTimeout(timeout time.Duration) ClientOption {
	return func(c *Client) { c.snapshotTimeout = timeout }
}

func New(cc grpc.ClientConnInterface, reg prometheus.Registerer, options ...ClientOption) (*Client, error) {
	authzlibclient := authzlib.NewClient(cc, authzlib.WithTracerClientOption(tracer))
	c := &Client{
		authzlibclient: authzlibclient,
		snapshotClient: authzlib.NewClient(cc, authzlib.WithTracerClientOption(tracer), authzlib.WithCacheClientOption(snapshotNoopCache{})),
		authz:          authzv1.NewAuthzServiceClient(cc),
		authzext:       authzextv1.NewAuthzExtentionServiceClient(cc),
		logger:         log.New("zanzana.client"),
		metrics:        newClientMetrics(reg),
	}
	for _, option := range options {
		option(c)
	}

	return c, nil
}

func (c *Client) Check(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	ctx, span := tracer.Start(ctx, "authlib.zanzana.client.Check")
	defer span.End()

	timer := prometheus.NewTimer(c.metrics.requestDurationSeconds.WithLabelValues("Check"))
	defer timer.ObserveDuration()

	return c.authzlibclient.Check(ctx, id, req, folder)
}

func (c *Client) Compile(ctx context.Context, id authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	ctx, span := tracer.Start(ctx, "authlib.zanzana.client.Compile")
	defer span.End()

	timer := prometheus.NewTimer(c.metrics.requestDurationSeconds.WithLabelValues("Compile"))
	defer timer.ObserveDuration()

	return c.authzlibclient.Compile(ctx, id, req)
}

func (c *Client) BatchCheck(ctx context.Context, id authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	ctx, span := tracer.Start(ctx, "authlib.zanzana.client.BatchCheck")
	defer span.End()

	timer := prometheus.NewTimer(c.metrics.requestDurationSeconds.WithLabelValues("BatchCheck"))
	defer timer.ObserveDuration()

	return c.authzlibclient.BatchCheck(ctx, id, req)
}

func (c *Client) List(ctx context.Context, req *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	ctx, span := tracer.Start(ctx, "authlib.zanzana.client.List")
	defer span.End()

	timer := prometheus.NewTimer(c.metrics.requestDurationSeconds.WithLabelValues("List"))
	defer timer.ObserveDuration()

	return c.authz.List(ctx, req)
}

func (c *Client) Read(ctx context.Context, req *authzextv1.ReadRequest) (*authzextv1.ReadResponse, error) {
	ctx, span := tracer.Start(ctx, "authlib.zanzana.client.Read")
	defer span.End()

	timer := prometheus.NewTimer(c.metrics.requestDurationSeconds.WithLabelValues("Read"))
	defer timer.ObserveDuration()

	return c.authzext.Read(ctx, req)
}

func (c *Client) Write(ctx context.Context, req *authzextv1.WriteRequest) error {
	ctx, span := tracer.Start(ctx, "authlib.zanzana.client.Write")
	defer span.End()

	timer := prometheus.NewTimer(c.metrics.requestDurationSeconds.WithLabelValues("Write"))
	defer timer.ObserveDuration()

	_, err := c.authzext.Write(ctx, req)
	return err
}

func (c *Client) Mutate(ctx context.Context, req *authzextv1.MutateRequest) error {
	ctx, span := tracer.Start(ctx, "authlib.zanzana.client.Mutate")
	defer span.End()

	timer := prometheus.NewTimer(c.metrics.requestDurationSeconds.WithLabelValues("Mutate"))
	defer timer.ObserveDuration()

	_, err := c.authzext.Mutate(ctx, req)
	return err
}

func (c *Client) Query(ctx context.Context, req *authzextv1.QueryRequest) (*authzextv1.QueryResponse, error) {
	ctx, span := tracer.Start(ctx, "authlib.zanzana.client.Query")
	defer span.End()

	timer := prometheus.NewTimer(c.metrics.requestDurationSeconds.WithLabelValues("Query"))
	defer timer.ObserveDuration()

	return c.authzext.Query(ctx, req)
}

var _ authlib.UserPermissionsClient = (*Client)(nil)

func (c *Client) GetUserPermissions(ctx context.Context, id authlib.AuthInfo, req authlib.GetUserPermissionsRequest) (authlib.GetUserPermissionsResponse, error) {
	timer := prometheus.NewTimer(c.metrics.requestDurationSeconds.WithLabelValues("GetUserPermissions"))
	defer timer.ObserveDuration()
	// Unary interceptors do not cover streaming RPCs. Keep the deadline active
	// until authlib has received and validated the complete permission response.
	var cancel context.CancelFunc
	if _, hasDeadline := ctx.Deadline(); !hasDeadline && c.snapshotTimeout > 0 {
		ctx, cancel = context.WithTimeout(ctx, c.snapshotTimeout)
	} else {
		ctx, cancel = context.WithCancel(ctx)
	}
	defer cancel()
	result, err := c.snapshotClient.GetUserPermissions(ctx, id, req)
	if err != nil && ctx.Err() != nil {
		// Authlib propagates cancellation to its transport context without its
		// deadline, so restore the caller's distinction between timeout and cancel.
		return authlib.GetUserPermissionsResponse{}, status.FromContextError(ctx.Err()).Err()
	}
	return result, err
}

func (c *Client) InvalidateUserPermissions(ctx context.Context, id authlib.AuthInfo, req authlib.GetUserPermissionsRequest) error {
	return c.snapshotClient.InvalidateUserPermissions(ctx, id, req)
}

// Keep request-time teams and shared-principal caching on the server rather than
// caching a flattened user result in the client.
type snapshotNoopCache struct{}

func (snapshotNoopCache) Get(context.Context, string) ([]byte, error)              { return nil, cache.ErrNotFound }
func (snapshotNoopCache) Set(context.Context, string, []byte, time.Duration) error { return nil }
func (snapshotNoopCache) Delete(context.Context, string) error                     { return nil }
