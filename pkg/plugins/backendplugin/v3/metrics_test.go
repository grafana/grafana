package v3

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana/pkg/plugins"
)

func TestErrorResult(t *testing.T) {
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	expired, cancelExpired := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
	defer cancelExpired()

	for _, tt := range []struct {
		name string
		ctx  context.Context
		err  error
		want Result
	}{
		{name: "no error", err: nil, want: ResultOK},
		{name: "caller went away", ctx: canceled, err: status.Error(codes.Canceled, "canceled"), want: ResultCanceled},
		{name: "caller's deadline passed", ctx: expired, err: status.Error(codes.DeadlineExceeded, "deadline"), want: ResultTimeout},
		{name: "context deadline", err: fmt.Errorf("call: %w", context.DeadlineExceeded), want: ResultTimeout},
		{name: "context canceled", err: fmt.Errorf("call: %w", context.Canceled), want: ResultCanceled},
		{name: "network timeout", err: &net.OpError{Op: "dial", Err: timeoutError{}}, want: ResultTimeout},
		{name: "plugin unavailable", err: plugins.ErrPluginUnavailable, want: ResultUnavailable},
		{name: "plugin not registered", err: plugins.ErrPluginNotRegistered, want: ResultUnavailable},
		{name: "grpc connection unavailable", err: plugins.ErrPluginGrpcConnectionUnavailableBaseFn(context.Background()).Errorf("gone"), want: ResultUnavailable},
		{name: "plugin not running", err: apierrors.NewServiceUnavailable("the plugin backend does not implement ClientV3"), want: ResultUnavailable},
		{name: "kubernetes not found", err: apierrors.NewNotFound(schemaGroupResource, "x"), want: ResultClientError},
		{name: "kubernetes internal error", err: apierrors.NewInternalError(errors.New("boom")), want: ResultServerError},
		{name: "grpc unavailable", err: status.Error(codes.Unavailable, "down"), want: ResultUnavailable},
		{name: "grpc deadline", err: status.Error(codes.DeadlineExceeded, "slow"), want: ResultTimeout},
		{name: "grpc canceled", err: status.Error(codes.Canceled, "canceled"), want: ResultCanceled},
		{name: "grpc invalid argument", err: status.Error(codes.InvalidArgument, "bad"), want: ResultClientError},
		{name: "grpc permission denied", err: status.Error(codes.PermissionDenied, "no"), want: ResultClientError},
		{name: "grpc internal", err: status.Error(codes.Internal, "boom"), want: ResultServerError},
		{name: "grpc unimplemented", err: status.Error(codes.Unimplemented, "no route"), want: ResultServerError},
		{name: "grpc resource exhausted", err: status.Error(codes.ResourceExhausted, "busy"), want: ResultServerError},
		{name: "unclassified", err: errors.New("boom"), want: ResultServerError},
	} {
		t.Run(tt.name, func(t *testing.T) {
			ctx := tt.ctx
			if ctx == nil {
				ctx = context.Background()
			}
			require.Equal(t, tt.want, ErrorResult(ctx, tt.err))
		})
	}
}

func TestStatusCodeResult(t *testing.T) {
	for code, want := range map[int]Result{
		0:   ResultServerError, // the unset result passed below
		200: ResultOK,
		204: ResultOK,
		304: ResultOK,
		400: ResultClientError,
		404: ResultClientError,
		409: ResultClientError,
		429: ResultClientError,
		500: ResultServerError,
		502: ResultServerError,
		503: ResultUnavailable,
		504: ResultTimeout,
	} {
		require.Equal(t, want, StatusCodeResult(code, ResultServerError), "code %d", code)
	}
}

func TestInstrumentedAdmissionReview(t *testing.T) {
	for _, tt := range []struct {
		name string
		res  *pluginv3.AdmissionReviewResponse
		err  error
		want Result
	}{
		{name: "allowed", res: pluginv3.AdmissionReviewResponse_builder{Allowed: proto.Bool(true)}.Build(), want: ResultOK},
		{name: "denied without a code", res: admissionDenied(0), want: ResultClientError},
		{name: "denied as forbidden", res: admissionDenied(403), want: ResultClientError},
		{name: "plugin failed", res: admissionDenied(500), want: ResultServerError},
		{name: "unreachable", err: status.Error(codes.Unavailable, "down"), want: ResultUnavailable},
	} {
		t.Run(tt.name, func(t *testing.T) {
			m := NewMetrics(prometheus.NewRegistry())
			client := m.Instrument(&fakeClientV3{admission: func() (*pluginv3.AdmissionReviewResponse, error) {
				return tt.res, tt.err
			}}, testInstrumentOptions)

			_, _ = client.AdmissionReview(context.Background(), pluginv3.AdmissionReviewRequest_builder{
				Kind: pluginv3.GroupVersionKind_builder{Group: proto.String("example.ext.grafana.app")}.Build(),
			}.Build())

			requireCalls(t, m, "example.ext.grafana.app", EndpointAdmissionReview, tt.want, 1)
		})
	}
}

func TestInstrumentedConvertObjects(t *testing.T) {
	m := NewMetrics(prometheus.NewRegistry())
	client := m.Instrument(&fakeClientV3{conversion: func() (*pluginv3.ConvertObjectsResponse, error) {
		return pluginv3.ConvertObjectsResponse_builder{Error: pluginv3.StatusResult_builder{Message: proto.String("cannot convert")}.Build()}.Build(), nil
	}}, testInstrumentOptions)

	_, err := client.ConvertObjects(context.Background(), pluginv3.ConvertObjectsRequest_builder{
		Api: pluginv3.GroupVersion_builder{Group: proto.String("example.ext.grafana.app")}.Build(),
	}.Build())
	require.NoError(t, err)

	requireCalls(t, m, "example.ext.grafana.app", EndpointConvertObjects, ResultServerError, 1)
}

func TestInstrumentedCallRoute(t *testing.T) {
	routeRequest := pluginv3.CallRouteRequest_builder{Group: proto.String("example.ext.grafana.app")}.Build()

	t.Run("records the first response once", func(t *testing.T) {
		m := NewMetrics(prometheus.NewRegistry())
		stream := &fakeRouteStream{responses: []*pluginv3.CallRouteResponse{
			pluginv3.CallRouteResponse_builder{Code: proto.Int32(404)}.Build(),
			pluginv3.CallRouteResponse_builder{}.Build(),
		}}
		client := m.Instrument(&fakeClientV3{route: stream}, testInstrumentOptions)

		s, err := client.CallRoute(context.Background(), routeRequest)
		require.NoError(t, err)
		requireCallCount(t, m, 0)
		for {
			if _, err := s.Recv(); err != nil {
				require.ErrorIs(t, err, io.EOF)
				break
			}
		}

		requireCalls(t, m, "example.ext.grafana.app", EndpointCallRoute, ResultClientError, 1)
		requireCallCount(t, m, 1)
	})

	t.Run("a stream without a response failed", func(t *testing.T) {
		m := NewMetrics(prometheus.NewRegistry())
		client := m.Instrument(&fakeClientV3{route: &fakeRouteStream{}}, testInstrumentOptions)

		s, err := client.CallRoute(context.Background(), routeRequest)
		require.NoError(t, err)
		_, err = s.Recv()
		require.ErrorIs(t, err, io.EOF)

		requireCalls(t, m, "example.ext.grafana.app", EndpointCallRoute, ResultServerError, 1)
	})

	t.Run("an error before the first response", func(t *testing.T) {
		m := NewMetrics(prometheus.NewRegistry())
		client := m.Instrument(&fakeClientV3{route: &fakeRouteStream{err: status.Error(codes.Unavailable, "down")}}, testInstrumentOptions)

		s, err := client.CallRoute(context.Background(), routeRequest)
		require.NoError(t, err)
		_, err = s.Recv()
		require.Error(t, err)

		requireCalls(t, m, "example.ext.grafana.app", EndpointCallRoute, ResultUnavailable, 1)
	})

	t.Run("a failed call", func(t *testing.T) {
		m := NewMetrics(prometheus.NewRegistry())
		client := m.Instrument(&fakeClientV3{routeErr: status.Error(codes.Unavailable, "down")}, testInstrumentOptions)

		_, err := client.CallRoute(context.Background(), routeRequest)
		require.Error(t, err)

		requireCalls(t, m, "example.ext.grafana.app", EndpointCallRoute, ResultUnavailable, 1)
	})

	t.Run("an abandoned stream is canceled", func(t *testing.T) {
		m := NewMetrics(prometheus.NewRegistry())
		client := m.Instrument(&fakeClientV3{route: &fakeRouteStream{}}, testInstrumentOptions)
		ctx, cancel := context.WithCancel(context.Background())

		_, err := client.CallRoute(ctx, routeRequest)
		require.NoError(t, err)
		cancel()

		require.Eventually(t, func() bool {
			return testutil.ToFloat64(m.requests.WithLabelValues("example-app", "example.ext.grafana.app", EndpointCallRoute, TargetLocal, string(ResultCanceled))) == 1
		}, time.Second, time.Millisecond)
		requireCallCount(t, m, 1)
	})
}

func TestInstrumentedClientLabels(t *testing.T) {
	t.Run("unknown groups", func(t *testing.T) {
		m := NewMetrics(prometheus.NewRegistry())
		client := m.Instrument(&fakeClientV3{}, testInstrumentOptions)

		_, _ = client.ConvertObjects(context.Background(), pluginv3.ConvertObjectsRequest_builder{
			Api: pluginv3.GroupVersion_builder{Group: proto.String("other.ext.grafana.app")}.Build(),
		}.Build())

		requireCalls(t, m, unknownGroupLabel, EndpointConvertObjects, ResultOK, 1)
	})

	t.Run("panics are server errors", func(t *testing.T) {
		m := NewMetrics(prometheus.NewRegistry())
		client := m.Instrument(&fakeClientV3{admission: func() (*pluginv3.AdmissionReviewResponse, error) {
			panic("boom")
		}}, testInstrumentOptions)

		require.PanicsWithValue(t, "boom", func() {
			_, _ = client.AdmissionReview(context.Background(), pluginv3.AdmissionReviewRequest_builder{}.Build())
		})

		requireCalls(t, m, unknownGroupLabel, EndpointAdmissionReview, ResultServerError, 1)
	})

	t.Run("nil client", func(t *testing.T) {
		require.Nil(t, NewMetrics(prometheus.NewRegistry()).Instrument(nil, testInstrumentOptions))
	})
}

var testInstrumentOptions = InstrumentOptions{
	PluginID: "example-app",
	Target:   TargetLocal,
	Groups:   []string{"example.ext.grafana.app"},
}

var schemaGroupResource = schema.GroupResource{Group: "example.ext.grafana.app", Resource: "things"}

func requireCalls(t *testing.T, m *Metrics, group, endpoint string, result Result, want float64) {
	t.Helper()
	labels := []string{"example-app", group, endpoint, TargetLocal, string(result)}
	require.Equal(t, want, testutil.ToFloat64(m.requests.WithLabelValues(labels...)), "requests %v", labels)
	require.Equal(t, 1, testutil.CollectAndCount(m.duration), "duration series")
}

func requireCallCount(t *testing.T, m *Metrics, want int) {
	t.Helper()
	require.Equal(t, want, testutil.CollectAndCount(m.requests))
}

func admissionDenied(code int32) *pluginv3.AdmissionReviewResponse {
	return pluginv3.AdmissionReviewResponse_builder{
		Error: pluginv3.StatusResult_builder{Code: proto.Int32(code), Message: proto.String("denied")}.Build(),
	}.Build()
}

type timeoutError struct{}

func (timeoutError) Error() string   { return "i/o timeout" }
func (timeoutError) Timeout() bool   { return true }
func (timeoutError) Temporary() bool { return true }

type fakeClientV3 struct {
	admission  func() (*pluginv3.AdmissionReviewResponse, error)
	conversion func() (*pluginv3.ConvertObjectsResponse, error)
	route      *fakeRouteStream
	routeErr   error
}

func (c *fakeClientV3) AdmissionReview(context.Context, *pluginv3.AdmissionReviewRequest) (*pluginv3.AdmissionReviewResponse, error) {
	if c.admission == nil {
		return pluginv3.AdmissionReviewResponse_builder{Allowed: proto.Bool(true)}.Build(), nil
	}
	return c.admission()
}

func (c *fakeClientV3) ConvertObjects(context.Context, *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
	if c.conversion == nil {
		return pluginv3.ConvertObjectsResponse_builder{}.Build(), nil
	}
	return c.conversion()
}

func (c *fakeClientV3) CallRoute(ctx context.Context, _ *pluginv3.CallRouteRequest) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	if c.routeErr != nil {
		return nil, c.routeErr
	}
	c.route.ctx = ctx
	return c.route, nil
}

type fakeRouteStream struct {
	grpc.ClientStream
	ctx       context.Context
	responses []*pluginv3.CallRouteResponse
	err       error
}

func (s *fakeRouteStream) Context() context.Context { return s.ctx }

func (s *fakeRouteStream) Recv() (*pluginv3.CallRouteResponse, error) {
	if s.err != nil {
		return nil, s.err
	}
	if len(s.responses) == 0 {
		return nil, io.EOF
	}
	res := s.responses[0]
	s.responses = s.responses[1:]
	return res, nil
}
