---
title: Add distributed tracing for backend plugins
---

# Add distributed tracing for backend plugins

> **Note:** This feature requires at least Grafana 9.5.0, and your plugin needs to be built at least with
> grafana-plugins-sdk-go v0.157.0. If you run a plugin with tracing features on an older version of Grafana,
> tracing will be disabled.

> **Note:** Only Opentelemetry is supported. If Grafana is configured to use a deprecated tracing systems (Jaeger or Opentracing),
> tracing will be disabled in the plugin. Please note that Opentelemetry + Jaeger propagator is supported.

Distributed tracing allows backend plugin developers to create custom spans in their plugins, and send them to the same endpoint
as the main Grafana instance. This also propagates the tracing context from the Grafana instance to the plugin, so the plugin's spans
will be correlated to the correct trace.

<!-- TODO: link to OpenTelemetry configuration guide -->

OpenTelemetry must be enabled and configured for the Grafana instance. Please refer to this guide for more information.

As of Grafana 9.5.0, plugins tracing must be enabled manually on a per-plugin basis, by specifying `tracing = true` in the plugin's config section:

```ini
[plugin.myorg-myplugin-datasource]
tracing = true
```

Alternatively, environment variables can also be used:

<!-- TODO: confirm this is possible/correct -->

`GRAFANA_PLUGIN_GRAFANA_DATASOURCEHTTPBACKEND_DATASOURCE_TRACING=true`

## OpenTelemetry tracer

When OpenTelemetry tracing is enabled on the main Grafana instance and tracing is enabeld for a plugin,
the Opentelemetry endpoint address and propagation format will be passed to the plugin during startup,
which will be used to configure a global tracer.

<ol>
<li>The global tracer is configured automatically if you use <code>datasource.Manage</code> or <code>app.Manage</code> to run your plugin.

If you are not using them, you have to configure the global tracer manually by calling:

```go
backend.SetupTracer()
```

</li>

<li>
Once tracing is configured (either manually or by calling `Manage`), you can access the global tracer with:

```go
tracing.DefaultTracer()
```

this returns an OpenTelemetry `tracer.Tracer`, and can be used to create spans.

For example:

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
}
```

</li>

</ol>

<!-- TODO: link to OpenTelemetry Go SDK -->

Please refer to the OpenTelemetry Go SDK for in-depth documentation on all the features provided by OpenTelemetry.

If tracing is disabled in Grafana, `backend.DefaultTracer()` returns a no-op tracer.

## Custom tracer provider attributes

<!-- TODO: explain where to pass it -->

```go
// DatasourceOpts contains the default ManageOpts for the datasource.
var DatasourceOpts = datasource.ManageOpts{
    TracingOpts: tracing.Opts{
        // Optional custom attributes attached to the tracer's resource.
        // The tracer will already have some SDK and runtime ones pre-populated.
        CustomAttributes: []attribute.KeyValue{
            attribute.String("my_plugin.my_attribute", "custom value"),
        },
    },
}
```

## Tracing GRPC calls

A new span is created automatically for each GRPC call (`QueryData`, `CheckHealth`, etc), both on Grafana's side and
on the plugin's side.

This also injects the trace context into the `context.Context` passed to those methods.

<!-- TODO: URL to trace.SpanContext definition -->

This allows you to retreive the `trace.SpanContext` by using `tracing.SpanContextFromContext` by passing the original `context.Context` as first argument:

```go
func (d *Datasource) query(ctx context.Context, pCtx backend.PluginContext, query backend.DataQuery) (backend.DataResponse, error) {
    spanCtx := trace.SpanContextFromContext(ctx)
    traceID := spanCtx.TraceID()

    // ...
}
```

## Tracing HTTP requests

When tracing is enabled, a `TracingMiddleware` is also added to the default middleware stack to all http clients created
using the `httpclient.New` or `httpclient.NewProvider`, unless custom middlewares are specified.

This middleware creates spans for each outgoing HTTP request.
