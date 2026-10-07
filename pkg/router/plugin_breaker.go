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

// Check the group's breaker only when calling the plugin, so requests served
// entirely from storage remain available.
func (*tracedPluginHandler) breaksOnClientCalls() {}

var errPluginClientPanic = errors.New("router: plugin client panicked")

// Failures to reach the client and panics count against it. Errors in plugin
// responses (including admission rejection and HTTP 5xx) say nothing about reachability.
func pluginClientOutcome(ctx context.Context, err error) error {
	if ctx.Err() != nil {
		return fmt.Errorf("%w: %w", errCallerGone, ctx.Err())
	}
	if err == nil {
		return nil
	}
	switch {
	case errors.Is(err, errPluginClientPanic),
		errors.Is(err, plugins.ErrPluginNotRegistered),
		errors.Is(err, plugins.ErrPluginUnavailable),
		errors.Is(err, plugins.ErrPluginGrpcConnectionUnavailableBaseFn(ctx)),
		apierrors.IsServiceUnavailable(err):
		return err
	}
	if code := status.Code(err); code == codes.Unavailable || code == codes.DeadlineExceeded {
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
		if outcome, ok := ctx.Value(requestOutcomeKey{}).(*requestOutcome); ok && outcome != nil {
			outcome.failure = failureBreakerOpen
		}
		return nil, apierrors.NewServiceUnavailable("plugin backend unavailable")
	}
	// Streaming calls report on their first response and again when they end.
	var once sync.Once
	return func(err error) {
		once.Do(func() { done(pluginClientOutcome(ctx, err)) })
	}, nil
}

// reportPluginPanic releases an unsettled attempt before propagating the panic.
func reportPluginPanic(done func(error)) {
	if p := recover(); p != nil {
		done(errPluginClientPanic)
		panic(p)
	}
}

type breakerPluginClientV3 struct{ appclientv3.Client }

func (c *breakerPluginClientV3) AdmissionReview(ctx context.Context, req *pluginv3.AdmissionReviewRequest) (*pluginv3.AdmissionReviewResponse, error) {
	done, err := allowPluginCall(ctx)
	if err != nil {
		return nil, err
	}
	defer reportPluginPanic(done)
	res, err := c.Client.AdmissionReview(ctx, req)
	done(err)
	return res, err
}

func (c *breakerPluginClientV3) ConvertObjects(ctx context.Context, req *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
	done, err := allowPluginCall(ctx)
	if err != nil {
		return nil, err
	}
	defer reportPluginPanic(done)
	res, err := c.Client.ConvertObjects(ctx, req)
	done(err)
	return res, err
}

func (c *breakerPluginClientV3) CallRoute(ctx context.Context, req *pluginv3.CallRouteRequest) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	done, err := allowPluginCall(ctx)
	if err != nil {
		return nil, err
	}
	defer reportPluginPanic(done)
	stream, err := c.Client.CallRoute(ctx, req)
	if err != nil {
		done(err)
		return nil, err
	}
	// A caller may abandon the stream without receiving a response. Release its
	// trial slot on cancellation, and stop watching once the first result arrives.
	stop := context.AfterFunc(ctx, func() { done(ctx.Err()) })
	return &breakerPluginRouteStream{ServerStreamingClient: stream, done: func(err error) {
		stop()
		done(err)
	}}, nil
}

type breakerPluginRouteStream struct {
	grpc.ServerStreamingClient[pluginv3.CallRouteResponse]
	done func(error)
}

func (s *breakerPluginRouteStream) Recv() (*pluginv3.CallRouteResponse, error) {
	defer reportPluginPanic(s.done)
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
	defer reportPluginPanic(done)
	res, err := c.Client.CheckHealth(ctx, req)
	done(err)
	return res, err
}

func (c *breakerPluginClient) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	done, err := allowPluginCall(ctx)
	if err != nil {
		return err
	}
	defer reportPluginPanic(done)
	err = c.Client.CallResource(ctx, req, backend.CallResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
		done(nil)
		return sender.Send(res)
	}))
	done(err)
	return err
}
