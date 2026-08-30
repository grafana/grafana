---
description: Common TraceQL query examples for the Tempo data source based on real-world use cases.
keywords:
  - grafana
  - tempo
  - traceql
  - queries
  - examples
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: TraceQL query examples
title: TraceQL query examples
weight: 500
---

# TraceQL query examples

Use these TraceQL queries in Grafana **Explore** with a Tempo data source.
Adjust service names, routes, and attribute values to match your environment.

These examples use [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/general/trace/).
If your instrumentation uses different attribute names, substitute them in the queries.

For the full TraceQL syntax, refer to [Construct a TraceQL query](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql/construct-traceql-queries/).
For an extended recipe collection, refer to the [TraceQL cookbook for Grafana Cloud Traces](https://grafana.com/docs/grafana-cloud/send-data/traces/traces-query-editor/traceql-cookbook/).

{{< admonition type="tip" >}}
If a query returns no results, widen the time range and confirm the correct Tempo data source is selected.
Prefer trace-level intrinsic fields like `trace:duration` and `trace:rootService` for faster queries.
{{< /admonition >}}

## Find error spans

Filter by error status or HTTP error codes:

```traceql
{ status = error }
```

```traceql
{ span.http.status_code >= 500 }
```

```traceql
{ span.http.status_code > 399 }
```

## Find slow requests

Filter by span duration.
Common thresholds are 1 second and 5 seconds:

```traceql
{ duration > 1s }
```

```traceql
{ duration > 5s }
```

Filter a specific endpoint by duration:

```traceql
{ span.http.url = "/api/checkout" && duration > 2s }
```

## Find exceptions by type

Query exception events recorded on spans.
Exception data uses the `event` scope because OpenTelemetry records exceptions as span events:

```traceql
{ event.exception.message =~ "context cancelled" }
```

```traceql
{ event.exception.type = "NotFoundException" }
```

Find error spans that have an exception message:

```traceql
{ status = error && event.exception.message != "" }
```

## Filter by service

Select spans from a specific service or match services by pattern.
You can use the [Service Graph view](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/service-graph/) to identify which services have high error rates or latency, then query those services with TraceQL.

```traceql
{ resource.service.name = "checkout" }
```

```traceql
{ resource.service.name =~ "payment.*" && status = error }
```

## Find errors and slow spans together

Combine error status and duration filters to identify likely root causes:

```traceql
{ resource.service.name = "api" && status = error && duration > 1s }
```

## Analyze service dependencies

Find errors on a specific API path:

```traceql
{ span.http.url =~ ".*/api/.*" && span.http.status_code >= 500 }
```

Use the descendant operator (`>>`) to find traces where a frontend service calls a downstream service that errors:

```traceql
{ resource.service.name = "frontend" } >> { resource.service.name = "database" && status = error }
```

## Query rate and count metrics

Run these in **Metrics** mode in Explore.
TraceQL metrics queries have a default 24-hour time-range limit:

```traceql
{ } | rate()
```

```traceql
{ status = error } | rate()
```

```traceql
{ resource.service.name = "api" } | count_over_time()
```

```traceql
{ duration > 1s } | rate()
```

## Filter by region or environment

Narrow results to a specific cloud region or deployment environment:

```traceql
{ resource.cloud.region = "us-east-1" && status = error }
```

```traceql
{ resource.deployment.environment = "production" && duration > 2s }
```

## Use dashboard variables

Replace hard-coded values with [dashboard variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) when using these queries in panels.
For example, using a `$service` variable:

```traceql
{ resource.service.name = "$service" && status = error }
```

## More resources

- [TraceQL cookbook for Grafana Cloud Traces](https://grafana.com/docs/grafana-cloud/send-data/traces/traces-query-editor/traceql-cookbook/) - Extended recipe collection with additional examples
- [Construct a TraceQL query](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql/construct-traceql-queries/) - Full TraceQL syntax, scopes, and operators
- [Query tracing data](_index.md) - Query editor modes and options
- [Service Graph and Service Graph view](../service-graph/) - Visualize service dependencies
