package router

import (
	"context"
	"errors"
	"fmt"
	"sync"

	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/plugins"
)

// Only failures to reach the client count against it. Errors in plugin responses
// (including admission rejection and HTTP 5xx) say nothing about reachability.
func pluginClientOutcome(ctx context.Context, err error) error {
	if ctx.Err() != nil {
		return fmt.Errorf("%w: %w", errCallerGone, ctx.Err())
	}
	if err == nil {
		return nil
	}
	if errors.Is(err, plugins.ErrPluginNotRegistered) || errors.Is(err, plugins.ErrPluginUnavailable) || errors.Is(err, plugins.ErrPluginGrpcConnectionUnavailableBaseFn(ctx)) || apierrors.IsServiceUnavailable(err) {
		return err
	}
	switch status.Code(err) {
	case codes.Unavailable, codes.DeadlineExceeded:
		return err
	}
	return nil
}

func allowPluginCall(ctx context.Context) (func(error), error) {
	cb, ok := ctx.Value(clientBreakerKey{}).(*groupBreaker)
	if !ok {
		return func(error) {}, nil
	}
	done, err := cb.Allow()
	if err != nil {
		return nil, apierrors.NewServiceUnavailable("plugin backend unavailable")
	}
	var once sync.Once
	return func(err error) { once.Do(func() { done(pluginClientOutcome(ctx, err)) }) }, nil
}

type breakerPluginClientV3 struct{ appclientv3.Client }

func (c *breakerPluginClientV3) AdmissionReview(ctx context.Context, req *pluginv3.AdmissionReviewRequest) (*pluginv3.AdmissionReviewResponse, error) {
	done, err := allowPluginCall(ctx)
	if err != nil {
		return nil, err
	}
	res, err := c.Client.AdmissionReview(ctx, req)
	done(err)
	return res, err
}

func (c *breakerPluginClientV3) ConvertObjects(ctx context.Context, req *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
	done, err := allowPluginCall(ctx)
	if err != nil {
		return nil, err
	}
	res, err := c.Client.ConvertObjects(ctx, req)
	done(err)
	return res, err
}

func (c *breakerPluginClientV3) CallRoute(ctx context.Context, req *pluginv3.CallRouteRequest) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	done, err := allowPluginCall(ctx)
	if err != nil {
		return nil, err
	}
	stream, err := c.Client.CallRoute(ctx, req)
	if err != nil {
		done(err)
		return nil, err
	}
	return &breakerPluginRouteStream{ServerStreamingClient: stream, done: done}, nil
}

type breakerPluginRouteStream struct {
	grpc.ServerStreamingClient[pluginv3.CallRouteResponse]
	done func(error)
}

func (s *breakerPluginRouteStream) Recv() (*pluginv3.CallRouteResponse, error) {
	res, err := s.ServerStreamingClient.Recv()
	// gRPC can defer a connection error until Recv. The first response settles
	// the attempt so a long-lived stream cannot hold the half-open trial slot.
	s.done(err)
	return res, err
}

type breakerPluginClient struct{ plugins.Client }

func (c *breakerPluginClient) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	done, err := allowPluginCall(ctx)
	if err != nil {
		return nil, err
	}
	res, err := c.Client.CheckHealth(ctx, req)
	done(err)
	return res, err
}

func (c *breakerPluginClient) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	done, err := allowPluginCall(ctx)
	if err != nil {
		return err
	}
	err = c.Client.CallResource(ctx, req, &breakerPluginResponseSender{CallResourceResponseSender: sender, done: done})
	done(err)
	return err
}

type breakerPluginResponseSender struct {
	backend.CallResourceResponseSender
	done func(error)
}

func (s *breakerPluginResponseSender) Send(res *backend.CallResourceResponse) error {
	s.done(nil)
	return s.CallResourceResponseSender.Send(res)
}
