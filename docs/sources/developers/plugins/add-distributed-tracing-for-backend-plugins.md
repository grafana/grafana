---
title: Add distributed tracing for backend plugins
---

# Add distributed tracing for backend plugins

> **Note:** This feature requires at least Grafana 9.5.0, and your plugin needs to be built at least with grafana-plugins-sdk-go v0.157.0. If you run a plugin with tracing features on an older version of Grafana, tracing will be disabled.

Distributed tracing allows backend plugin developers to create custom spans in their plugins, and send them to the same endpoint and with the same propagation format as the main Grafana instance. The tracing context is also propagated from the Grafana instance to the plugin, so the plugin's spans will be correlated to the correct trace.

## PLugin configuration

Plugin tracing must be enabled manually on a per-plugin basis, by specifying `tracing = true` in the plugin's config section:

```ini
[plugin.myorg-myplugin-datasource]
tracing = true
```

If tracing is disabled in Grafana, `backend.DefaultTracer()` returns a no-op tracer.

### OpenTelemetry configuration

Grafana supports [OpenTelemetry](https://opentelemetry.io/) for distributed tracing. If Grafana is configured to use a deprecated tracing system (Jaeger or OpenTracing), then tracing will be disabled in the plugin. 

> **Note:** Although Grafana doesn't support Jaeger, it supports [OpenTelemetry Jaeger propagator](https://www.npmjs.com/package/@opentelemetry/propagator-jaeger) for HTTP header propagation.

OpenTelemetry must be enabled and configured for the Grafana instance. Please refer to [the documentation](
{{< relref "../../setup-grafana/configure-grafana/#tracingopentelemetry" >}}) for more information.

Refer to the [OpenTelemetry Go SDK](https://pkg.go.dev/go.opentelemetry.io/otel) for in-depth documentation about all the features provided by OpenTelemetry.

## Implement tracing in your plugin

> **Note:** Make sure you are using at least grafana-plugin-sdk-go v0.157.0. You can update with `go get -u github.com/grafana/grafana-plugin-sdk-go`.

### Configure a global tracer

When OpenTelemetry tracing is enabled on the main Grafana instance and tracing is enabled for a plugin,
the OpenTelemetry endpoint address and propagation format will be passed to the plugin during startup. These parameters will be used to configure a global tracer.

1. Use <code>datasource.Manage</code> or <code>app.Manage</code> to run your plugin, and then the global tracer will be configured automatically. 

   This also allows you to specify custom attributes for the default tracer:

   ```go
   func main() {
       if err := datasource.Manage("MY_PLUGIN_ID", plugin.NewDatasource, datasource.ManageOpts{
           TracingOpts: tracing.Opts{
               // Optional custom attributes attached to the tracer's resource.
               // The tracer will already have some SDK and runtime ones pre-populated.
               CustomAttributes: []attribute.KeyValue{
                   attribute.String("my_plugin.my_attribute", "custom value"),
               },
           },
       }); err != nil {
           log.DefaultLogger.Error(err.Error())
           os.Exit(1)
       }
   }
   ```

1. Once you have configured tracing, retrieve the global tracer with:

   ```go
   tracing.DefaultTracer()
   ```

   This returns an OpenTelemetry [`trace.Tracer`](https://pkg.go.dev/go.opentelemetry.io/otel/trace#Tracer) for creating spans.

   **Example:**

   ```go
   func (d *Datasource) query(ctx context.Context, pCtx backend.PluginContext, query backend.DataQuery) (backend.DataResponse, error) {
       ctx, span := tracing.DefaultTracer().Start(
           ctx,
           "query processing",
           trace.WithAttributes(
               attribute.String("query.ref_id", query.RefID),
               attribute.String("query.type", query.QueryType),
               attribute.Int64("query.max_data_points", query.MaxDataPoints),
               attribute.Int64("query.interval_ms", query.Interval.Milliseconds()),
               attribute.Int64("query.time_range.from", query.TimeRange.From.Unix()),
               attribute.Int64("query.time_range.to", query.TimeRange.To.Unix()),
           ),
       )
       defer span.End()
       log.DefaultLogger.Debug("query", "traceID", trace.SpanContextFromContext(ctx).TraceID())

       // ...
   }
   ```

### Tracing gRPC calls

When tracing is enabled, a new span is created automatically for each gRPC call (`QueryData`, `CheckHealth`, etc), both on Grafana's side and on the plugin's side.

This also injects the trace context into the `context.Context` passed to those methods.

You can retrieve the [`trace.SpanContext`](https://pkg.go.dev/go.opentelemetry.io/otel/trace#SpanContext) with `tracing.SpanContextFromContext` by passing the original `context.Context` to it:

```go
func (d *Datasource) query(ctx context.Context, pCtx backend.PluginContext, query backend.DataQuery) (backend.DataResponse, error) {
    spanCtx := trace.SpanContextFromContext(ctx)
    traceID := spanCtx.TraceID()

    // ...
}
```

### Tracing HTTP requests

When tracing is enabled, a `TracingMiddleware` is also added to the default middleware stack to all HTTP clients created using the `httpclient.New` or `httpclient.NewProvider`, unless custom middlewares is specified.

This middleware creates spans for each outgoing HTTP request and provides some useful attributes and events related to the request's lifecycle.

## Plugin example

Refer to the [datasource-http-backend plugin example](https://github.com/grafana/grafana-plugin-examples/tree/main/examples/datasource-http-backend) for a complete example of a plugin with full distributed tracing support.
