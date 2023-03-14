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
		name        string
		run         func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error
		expSpanName string
	}{
		{
			name: "QueryData",
			run: func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error {
				_, err := cdt.Decorator.QueryData(context.Background(), &backend.QueryDataRequest{
					PluginContext: pluginCtx,
				})
				return err
			},
			expSpanName: "queryData",
		},
		{
			name: "CallResource",
			run: func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error {
				return cdt.Decorator.CallResource(context.Background(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
				}, nopCallResourceSender)
			},
			expSpanName: "callResource",
		},
		{
			name: "CheckHealth",
			run: func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error {
				_, err := cdt.Decorator.CheckHealth(context.Background(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
				})
				return err
			},
			expSpanName: "checkHealth",
		},
		{
			name: "CollectMetrics",
			run: func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error {
				_, err := cdt.Decorator.CollectMetrics(context.Background(), &backend.CollectMetricsRequest{
					PluginContext: pluginCtx,
				})
				return err
			},
			expSpanName: "collectMetrics",
		},
		{
			name: "SubscribeStream",
			run: func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error {
				_, err := cdt.Decorator.SubscribeStream(context.Background(), &backend.SubscribeStreamRequest{
					PluginContext: pluginCtx,
				})
				return err
			},
			expSpanName: "subscribeStream",
		},
		{
			name: "PublishStream",
			run: func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error {
				_, err := cdt.Decorator.PublishStream(context.Background(), &backend.PublishStreamRequest{
					PluginContext: pluginCtx,
				})
				return err
			},
			expSpanName: "publishStream",
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
				assert.Equal(t, "PluginClient."+tc.expSpanName, span.Name)
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

func TestTracingMiddlewareAttributes(t *testing.T) {
	defaultPluginContextMut := func(pluginContext *backend.PluginContext) {
		pluginContext.PluginID = "my_plugin_id"
		pluginContext.OrgID = 1337
	}

	for _, tc := range []struct {
		name             string
		pluginContextMut []func(pluginContext *backend.PluginContext)
		assert           func(t *testing.T, span *tracing.FakeSpan)
	}{
		{
			name: "default",
			pluginContextMut: []func(pluginContext *backend.PluginContext){
				defaultPluginContextMut,
			},
			assert: func(t *testing.T, span *tracing.FakeSpan) {
				assert.Len(t, span.Attributes, 2, "should have correct number of span attributes")
				assert.Equal(t, "my_plugin_id", span.Attributes["plugin_id"].AsString(), "should have correct plugin_id")
				assert.Equal(t, int64(1337), span.Attributes["org_id"].AsInt64(), "should have correct org_id")
				_, ok := span.Attributes["user"]
				assert.False(t, ok, "should not have user attribute")
			},
		},
		{
			name: "with user",
			pluginContextMut: []func(pluginContext *backend.PluginContext){
				defaultPluginContextMut,
				func(pluginContext *backend.PluginContext) {
					pluginContext.User = &backend.User{Login: "admin"}
				},
			},
			assert: func(t *testing.T, span *tracing.FakeSpan) {
				assert.Len(t, span.Attributes, 3, "should have correct number of span attributes")
				assert.Equal(t, "my_plugin_id", span.Attributes["plugin_id"].AsString(), "should have correct plugin_id")
				assert.Equal(t, int64(1337), span.Attributes["org_id"].AsInt64(), "should have correct org_id")
				assert.Equal(t, "admin", span.Attributes["user"].AsString(), "should have correct user attribute")
			},
		},
		{
			name:             "empty retains zero values",
			pluginContextMut: []func(pluginContext *backend.PluginContext){},
			assert: func(t *testing.T, span *tracing.FakeSpan) {
				assert.Len(t, span.Attributes, 2, "should have correct number of span attributes")
				assert.Zero(t, span.Attributes["plugin_id"].AsString(), "should have correct plugin_id")
				assert.Zero(t, span.Attributes["org_id"].AsInt64(), "should have correct org_id")
				_, ok := span.Attributes["user"]
				assert.False(t, ok, "should not have user attribute")
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			pluginCtx := backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
			}
			for _, mut := range tc.pluginContextMut {
				mut(&pluginCtx)
			}

			tracer := tracing.NewFakeTracer()

			cdt := clienttest.NewClientDecoratorTest(
				t,
				clienttest.WithMiddlewares(NewTracingMiddleware(tracer)),
			)

			_, err := cdt.Decorator.QueryData(context.Background(), &backend.QueryDataRequest{
				PluginContext: pluginCtx,
			})
			require.NoError(t, err)
			require.Len(t, tracer.Spans, 1, "must have 1 span")
			span := tracer.Spans[0]
			assert.True(t, span.IsEnded(), "span should be ended")
			assert.NoError(t, span.Err, "span should not have an error")
			assert.Equal(t, codes.Unset, span.StatusCode, "span should not have a status code")

			if tc.assert != nil {
				tc.assert(t, span)
			}
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
