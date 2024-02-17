package clientmiddleware

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
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
			expSpanName: "PluginClient.queryData",
		},
		{
			name: "CallResource",
			run: func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error {
				return cdt.Decorator.CallResource(context.Background(), &backend.CallResourceRequest{
					PluginContext: pluginCtx,
				}, nopCallResourceSender)
			},
			expSpanName: "PluginClient.callResource",
		},
		{
			name: "CheckHealth",
			run: func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error {
				_, err := cdt.Decorator.CheckHealth(context.Background(), &backend.CheckHealthRequest{
					PluginContext: pluginCtx,
				})
				return err
			},
			expSpanName: "PluginClient.checkHealth",
		},
		{
			name: "CollectMetrics",
			run: func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error {
				_, err := cdt.Decorator.CollectMetrics(context.Background(), &backend.CollectMetricsRequest{
					PluginContext: pluginCtx,
				})
				return err
			},
			expSpanName: "PluginClient.collectMetrics",
		},
		{
			name: "SubscribeStream",
			run: func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error {
				_, err := cdt.Decorator.SubscribeStream(context.Background(), &backend.SubscribeStreamRequest{
					PluginContext: pluginCtx,
				})
				return err
			},
			expSpanName: "PluginClient.subscribeStream",
		},
		{
			name: "PublishStream",
			run: func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error {
				_, err := cdt.Decorator.PublishStream(context.Background(), &backend.PublishStreamRequest{
					PluginContext: pluginCtx,
				})
				return err
			},
			expSpanName: "PluginClient.publishStream",
		},
		{
			name: "RunStream",
			run: func(pluginCtx backend.PluginContext, cdt *clienttest.ClientDecoratorTest) error {
				return cdt.Decorator.RunStream(context.Background(), &backend.RunStreamRequest{
					PluginContext: pluginCtx,
				}, &backend.StreamSender{})
			},
			expSpanName: "PluginClient.runStream",
		},
	} {
		t.Run("Creates spans on "+tc.name, func(t *testing.T) {
			t.Run("successful", func(t *testing.T) {
				spanRecorder := tracetest.NewSpanRecorder()
				tracer := tracing.InitializeTracerForTest(tracing.WithSpanProcessor(spanRecorder))

				cdt := clienttest.NewClientDecoratorTest(
					t,
					clienttest.WithMiddlewares(NewTracingMiddleware(tracer)),
				)

				err := tc.run(pluginCtx, cdt)
				require.NoError(t, err)
				spans := spanRecorder.Ended()
				require.Len(t, spans, 1, "must have 1 span")
				span := spans[0]
				assert.Empty(t, span.Events(), "span should not have an error")
				assert.Equal(t, codes.Unset, span.Status().Code, "span should not have a status code")
				assert.Equal(t, tc.expSpanName, span.Name())
			})

			t.Run("error", func(t *testing.T) {
				spanRecorder := tracetest.NewSpanRecorder()
				tracer := tracing.InitializeTracerForTest(tracing.WithSpanProcessor(spanRecorder))

				cdt := clienttest.NewClientDecoratorTest(
					t,
					clienttest.WithMiddlewares(
						NewTracingMiddleware(tracer),
						newAlwaysErrorMiddleware(errors.New("ops")),
					),
				)

				err := tc.run(pluginCtx, cdt)
				require.Error(t, err)
				spans := spanRecorder.Ended()
				require.Len(t, spans, 1, "must have 1 span")
				span := spans[0]
				require.Len(t, span.Events(), 1, "span should contain an error")
				require.Equal(t, semconv.ExceptionEventName, span.Events()[0].Name)
				require.Equal(t, codes.Error, span.Status().Code, "span code should be error")
			})

			t.Run("panic", func(t *testing.T) {
				var didPanic bool

				spanRecorder := tracetest.NewSpanRecorder()
				tracer := tracing.InitializeTracerForTest(tracing.WithSpanProcessor(spanRecorder))

				cdt := clienttest.NewClientDecoratorTest(
					t,
					clienttest.WithMiddlewares(
						NewTracingMiddleware(tracer),
						newAlwaysPanicMiddleware("panic!"),
					),
				)

				func() {
					defer func() {
						// Swallow panic so the test can keep running,
						// and we can assert that the client panicked
						if r := recover(); r != nil {
							didPanic = true
						}
					}()
					_ = tc.run(pluginCtx, cdt)
				}()

				require.True(t, didPanic, "should have panicked")
				require.Len(t, spanRecorder.Ended(), 1, "must have 1 span")
			})
		})
	}
}

func TestTracingMiddlewareAttributes(t *testing.T) {
	defaultPluginContextRequestMut := func(ctx *context.Context, req *backend.QueryDataRequest) {
		req.PluginContext.PluginID = "my_plugin_id"
		req.PluginContext.OrgID = 1337
	}

	for _, tc := range []struct {
		name       string
		requestMut []func(ctx *context.Context, req *backend.QueryDataRequest)
		assert     func(t *testing.T, span trace.ReadOnlySpan)
	}{
		{
			name: "default",
			requestMut: []func(ctx *context.Context, req *backend.QueryDataRequest){
				defaultPluginContextRequestMut,
			},
			assert: func(t *testing.T, span trace.ReadOnlySpan) {
				attribs := span.Attributes()
				require.Len(t, attribs, 2, "should have correct number of span attributes")
				require.True(t, spanAttributesContains(attribs, attribute.String("plugin_id", "my_plugin_id")))
				require.True(t, spanAttributesContains(attribs, attribute.Int("org_id", 1337)))
			},
		},
		{
			name: "with user",
			requestMut: []func(ctx *context.Context, req *backend.QueryDataRequest){
				defaultPluginContextRequestMut,
				func(ctx *context.Context, req *backend.QueryDataRequest) {
					req.PluginContext.User = &backend.User{Login: "admin"}
				},
			},
			assert: func(t *testing.T, span trace.ReadOnlySpan) {
				attribs := span.Attributes()
				assert.Len(t, attribs, 3, "should have correct number of span attributes")
				require.True(t, spanAttributesContains(attribs, attribute.String("plugin_id", "my_plugin_id")))
				require.True(t, spanAttributesContains(attribs, attribute.Int("org_id", 1337)))
				require.True(t, spanAttributesContains(attribs, attribute.String("user", "admin")))
			},
		},
		{
			name:       "empty retains zero values",
			requestMut: []func(ctx *context.Context, req *backend.QueryDataRequest){},
			assert: func(t *testing.T, span trace.ReadOnlySpan) {
				attribs := span.Attributes()
				require.Len(t, attribs, 2, "should have correct number of span attributes")
				require.True(t, spanAttributesContains(attribs, attribute.String("plugin_id", "")))
				require.True(t, spanAttributesContains(attribs, attribute.Int("org_id", 0)))
			},
		},
		{
			name: "no http headers",
			requestMut: []func(ctx *context.Context, req *backend.QueryDataRequest){
				func(ctx *context.Context, req *backend.QueryDataRequest) {
					*ctx = ctxkey.Set(*ctx, &contextmodel.ReqContext{Context: &web.Context{Req: &http.Request{Header: nil}}})
				},
			},
			assert: func(t *testing.T, span trace.ReadOnlySpan) {
				attribs := span.Attributes()
				require.True(t, spanAttributesContains(attribs, attribute.String("plugin_id", "")))
				require.True(t, spanAttributesContains(attribs, attribute.Int("org_id", 0)))
			},
		},
		{
			name: "datasource settings",
			requestMut: []func(ctx *context.Context, req *backend.QueryDataRequest){
				func(ctx *context.Context, req *backend.QueryDataRequest) {
					req.PluginContext.DataSourceInstanceSettings = &backend.DataSourceInstanceSettings{
						UID:  "uid",
						Name: "name",
						Type: "type",
					}
				},
			},
			assert: func(t *testing.T, span trace.ReadOnlySpan) {
				attribs := span.Attributes()
				require.Len(t, attribs, 4)
				require.True(t, spanAttributesContains(attribs, attribute.String("plugin_id", "")))
				require.True(t, spanAttributesContains(attribs, attribute.Int("org_id", 0)))
				require.True(t, spanAttributesContains(attribs, attribute.String("datasource_uid", "uid")))
				require.True(t, spanAttributesContains(attribs, attribute.String("datasource_name", "name")))
			},
		},
		{
			name: "http headers",
			requestMut: []func(ctx *context.Context, req *backend.QueryDataRequest){
				func(ctx *context.Context, req *backend.QueryDataRequest) {
					*ctx = ctxkey.Set(*ctx, newReqContextWithRequest(&http.Request{
						Header: map[string][]string{
							"X-Panel-Id":       {"10"},
							"X-Dashboard-Uid":  {"dashboard uid"},
							"X-Query-Group-Id": {"query group id"},
							"X-Other":          {"30"},
						},
					}))
				},
			},
			assert: func(t *testing.T, span trace.ReadOnlySpan) {
				attribs := span.Attributes()
				require.Len(t, attribs, 5)
				require.True(t, spanAttributesContains(attribs, attribute.String("plugin_id", "")))
				require.True(t, spanAttributesContains(attribs, attribute.Int("org_id", 0)))
				require.True(t, spanAttributesContains(attribs, attribute.Int("panel_id", 10)))
				require.True(t, spanAttributesContains(attribs, attribute.String("query_group_id", "query group id")))
				require.True(t, spanAttributesContains(attribs, attribute.String("dashboard_uid", "dashboard uid")))
			},
		},
		{
			name: "single http headers are skipped if not present or empty",
			requestMut: []func(ctx *context.Context, req *backend.QueryDataRequest){
				func(ctx *context.Context, req *backend.QueryDataRequest) {
					*ctx = ctxkey.Set(*ctx, newReqContextWithRequest(&http.Request{
						Header: map[string][]string{
							"X-Dashboard-Uid": {""},
							"X-Other":         {"30"},
						},
					}))
				},
			},
			assert: func(t *testing.T, span trace.ReadOnlySpan) {
				attribs := span.Attributes()
				require.Len(t, attribs, 2)
				require.True(t, spanAttributesContains(attribs, attribute.String("plugin_id", "")))
				require.True(t, spanAttributesContains(attribs, attribute.Int("org_id", 0)))
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			req := &backend.QueryDataRequest{
				PluginContext: backend.PluginContext{},
			}
			for _, mut := range tc.requestMut {
				mut(&ctx, req)
			}

			spanRecorder := tracetest.NewSpanRecorder()
			tracer := tracing.InitializeTracerForTest(tracing.WithSpanProcessor(spanRecorder))

			cdt := clienttest.NewClientDecoratorTest(
				t,
				clienttest.WithMiddlewares(NewTracingMiddleware(tracer)),
			)

			_, err := cdt.Decorator.QueryData(ctx, req)
			require.NoError(t, err)
			spans := spanRecorder.Ended()
			require.Len(t, spans, 1, "must have 1 span")
			span := spans[0]
			assert.Len(t, span.Events(), 0, "span should not have an error")
			assert.Equal(t, codes.Unset, span.Status().Code, "span should not have a status code")

			if tc.assert != nil {
				tc.assert(t, span)
			}
		})
	}
}

func spanAttributesContains(attribs []attribute.KeyValue, attrib attribute.KeyValue) bool {
	for _, v := range attribs {
		if v.Key == attrib.Key && v.Value == attrib.Value {
			return true
		}
	}

	return false
}

func newReqContextWithRequest(req *http.Request) *contextmodel.ReqContext {
	return &contextmodel.ReqContext{
		Context: &web.Context{
			Req: req,
		},
	}
}

// alwaysErrorFuncMiddleware is a middleware that runs the specified f function for each method, and returns the error
// returned by f. Any other return values are set to their zero-value.
// If recovererFunc is specified, it is run in case of panic in the middleware (f).
type alwaysErrorFuncMiddleware struct {
	f func() error
}

func (m *alwaysErrorFuncMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return nil, m.f()
}

func (m *alwaysErrorFuncMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return m.f()
}

func (m *alwaysErrorFuncMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return nil, m.f()
}

func (m *alwaysErrorFuncMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return nil, m.f()
}

func (m *alwaysErrorFuncMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return nil, m.f()
}

func (m *alwaysErrorFuncMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return nil, m.f()
}

func (m *alwaysErrorFuncMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return m.f()
}

// newAlwaysErrorMiddleware returns a new middleware that always returns the specified error.
func newAlwaysErrorMiddleware(err error) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &alwaysErrorFuncMiddleware{func() error {
			return err
		}}
	})
}

// newAlwaysPanicMiddleware returns a new middleware that always panics with the specified message,
func newAlwaysPanicMiddleware(message string) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &alwaysErrorFuncMiddleware{func() error {
			panic(message)
			return nil // nolint:govet
		}}
	})
}
