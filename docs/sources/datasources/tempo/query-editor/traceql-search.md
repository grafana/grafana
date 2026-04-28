---
description: Learn how to build TraceQL queries visually using the Search query builder in Grafana Explore.
keywords:
  - grafana
  - tempo
  - traces
  - queries
  - search
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Search traces
title: Search traces using the query builder
weight: 300
---

# Search traces using the query builder

The **Search** query builder lets you create TraceQL queries using drop-down lists and text fields instead of writing syntax directly.
Each selection you make generates a TraceQL query behind the scenes.
You can view the generated query and copy it to the [TraceQL editor](../traceql-editor/) at any time.

Use Search when you're exploring data or learning TraceQL patterns.
For complex queries involving structural operators, aggregations, or features that Search doesn't support, use the [TraceQL editor](../traceql-editor/).
To learn the full query syntax, refer to [Construct a TraceQL query](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql/construct-traceql-queries/).

If queries return no results, check that your [Tempo data source is configured and connected](../configure-tempo-data-source/).

## Enable Search with the query builder

This feature is automatically available in Grafana 10 (and newer) and Grafana Cloud.

To enable the TraceQL query builder in self-managed Grafana through version 10.1, [enable the `traceqlSearch` feature toggle](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/).

[//]: # 'Shared content for the Search - TraceQL query builder'

{{< docs/shared source="grafana" lookup="datasources/tempo-search-traceql.md" leveloffset="+1" version="<GRAFANA_VERSION>" >}}

## Try these common searches

The following examples show what to select in the Search builder and the TraceQL query each selection generates.
Adjust service names and values to match your environment.

**Find error spans for a service:**

1. Set **Service Name** to your service (for example, `frontend`).
1. Set **Status** to `error`.

Generated query:

```traceql
{ resource.service.name = "frontend" && status = error }
```

**Find slow API calls:**

1. Set **Span Name** to the operation (for example, `POST /api/orders`).
1. Set **Duration** to `>` `500ms`.

Generated query:

```traceql
{ name = "POST /api/orders" && duration > 500ms }
```

**Filter by HTTP status code:**

1. Select **Add tag**, choose **span**, and select `http.response.status_code`.
1. Set the operator to `>=` and the value to `500`.

Generated query:

```traceql
{ span.http.response.status_code >= 500 }
```

For more query examples, refer to [TraceQL query examples](../traceql-query-examples/).

## Next steps

- [TraceQL query examples](../traceql-query-examples/): Copy-paste query examples for common use cases
- [Write TraceQL queries with the editor](../traceql-editor/): For complex queries the Search builder doesn't support
- [Construct a TraceQL query](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql/construct-traceql-queries/): Full TraceQL syntax reference
- [Service Graph and Service Graph view](../../service-graph/): Visualize service dependencies
- [Span filters](../../span-filters/): Refine results in the trace detail view
