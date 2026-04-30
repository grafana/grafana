---
description: Learn how to write TraceQL queries directly using the query editor in Grafana Explore.
keywords:
  - grafana
  - tempo
  - traces
  - queries
  - traceql
  - editor
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Write TraceQL queries
title: Write TraceQL queries with the editor
weight: 400
---

# Write TraceQL queries with the editor

Use the **TraceQL** editor when you need structural queries across parent and child spans, aggregations, or other features that the [Search query builder](../traceql-search/) doesn't support.
TraceQL queries follow the pattern `{ conditions } | pipeline`.
Refer to [Construct a TraceQL query](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql/construct-traceql-queries/) for the full syntax.

To get started, paste this query into the editor and select **Run query**:

```traceql
{ resource.service.name = "frontend" && span:status = error }
```

This returns all error spans from the `frontend` service.
Replace `frontend` with your service name.
For more examples, refer to [TraceQL query examples](../traceql-query-examples/).

If queries return no results, check that your [Tempo data source is configured and connected](../../configure-tempo-data-source/).

[//]: # 'Shared content for the TraceQL query editor'
[//]: # 'This content is located in /docs/sources/shared/datasources/tempo-editor-traceql.md'

{{< docs/shared source="grafana" lookup="datasources/tempo-editor-traceql.md" version="<GRAFANA_VERSION>" >}}

## Next steps

- [TraceQL query examples](../traceql-query-examples/): Copy-paste query examples for common use cases
- [Search traces using the query builder](../traceql-search/): Build queries visually
- [Construct a TraceQL query](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql/construct-traceql-queries/): Full TraceQL syntax reference
- [Service Graph and Service Graph view](../../service-graph/): Visualize service dependencies
- [Span filters](../../span-filters/): Refine results in the trace detail view
