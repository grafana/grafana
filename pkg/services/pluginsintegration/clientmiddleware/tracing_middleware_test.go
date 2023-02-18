package clientmiddleware

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/codes"
)

func TestTracingMiddleware(t *testing.T) {
	pluginCtx := backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
	}

	for _, tc := range []struct {
		name string
		run  func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error
	}{
		{
			name: "QueryData",
			run: func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error {
				_, err := cdt.Decorator.QueryData(context.Background(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
				})
				return err
			},
		},
		{
			name: "CallResource",
			run: func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error {
				return cdt.Decorator.CallResource(context.Background(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
				}, nopCallResourceSender)
			},
		},
		{
			name: "CheckHealth",
			run: func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error {
				_, err := cdt.Decorator.CheckHealth(context.Background(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
				})
				return err
			},
		},
		{
			name: "CollectMetrics",
			run: func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error {
				_, err := cdt.Decorator.CollectMetrics(context.Background(), &backend.CollectMetricsRequest{
					PluginContext: pluginCtx,
				})
				return err
			},
		},
		{
			name: "SubscribeStream",
			run: func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error {
				_, err := cdt.Decorator.SubscribeStream(context.Background(), &backend.SubscribeStreamRequest{
					PluginContext: pluginCtx,
				})
				return err
			},
		},
		{
			name: "PublishStream",
			run: func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error {
				_, err := cdt.Decorator.PublishStream(context.Background(), &backend.PublishStreamRequest{
					PluginContext: pluginCtx,
				})
				return err
			},
		},
		// TODO: RunStream?
	} {
		t.Run("Creates spans on "+tc.name, func(t *testing.T) {
			t.Run("successful", func(t *testing.T) {
				tracer := tracing.NewFakeTracer()

				cdt := clienttest.NewClientDecoratorTest(
					t,
					clienttest.WithMiddlewares(NewTracingMiddleware(tracer)),
				)

				err := tc.run(pluginCtx, cdt)
				require.NoError(t, err)
				require.Len(t, tracer.Spans, 1, "must have 1 span")
				span := tracer.Spans[0]
				assert.True(t, span.IsEnded(), "span should be ended")
				assert.NoError(t, span.Err, "span should not have an error")
				assert.Equal(t, codes.Unset, span.StatusCode, "span should not have a status code")
			})

			t.Run("error", func(t *testing.T) {
				tracer := tracing.NewFakeTracer()

				cdt := clienttest.NewClientDecoratorTest(
					t,
					clienttest.WithMiddlewares(
						NewTracingMiddleware(tracer),
						newAlwaysErrorMiddleware(errors.New("ops")),
					),
				)

				err := tc.run(pluginCtx, cdt)
				require.Error(t, err)
				require.Len(t, tracer.Spans, 1, "must have 1 span")
				span := tracer.Spans[0]
				assert.True(t, span.IsEnded(), "span should be ended")
				assert.Error(t, span.Err, "span should contain an error")
				assert.Equal(t, codes.Error, span.StatusCode, "span code should be error")
			})
		})
	}
}

// alwaysErrorMiddleware is a middleware that always returns the specified error
type alwaysErrorMiddleware struct {
	err error
}

func (m *alwaysErrorMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return nil, m.err
}

func (m *alwaysErrorMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return m.err
}

func (m *alwaysErrorMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return nil, m.err
}

func (m *alwaysErrorMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return nil, m.err
}

func (m *alwaysErrorMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return nil, m.err
}

func (m *alwaysErrorMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return nil, m.err
}

func (m *alwaysErrorMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return m.err
}

// newAlwaysErrorMiddleware returns a new *alwaysErrorMiddleware configured with the provided error
func newAlwaysErrorMiddleware(err error) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &alwaysErrorMiddleware{
			err: err,
		}
	})
}
