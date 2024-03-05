---
description: Tracing in Explore
keywords:
  - explore
  - trace
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Tracing in Explore
weight: 20
---

# Tracing in Explore

You can use Explore to query and visualize traces from tracing data sources.

Supported data sources are:

- [Tempo]({{< relref "../datasources/tempo/" >}}) (supported ingestion formats: OpenTelemetry, Jaeger, and Zipkin)
- [Jaeger]({{< relref "../datasources/jaeger/" >}})
- [Zipkin]({{< relref "../datasources/zipkin/" >}})
- [X-Ray](https://grafana.com/grafana/plugins/grafana-x-ray-datasource)
- [Azure Monitor Application Insights]({{< relref "../datasources/azure-monitor/" >}})
- [ClickHouse](https://github.com/grafana/clickhouse-datasource)

For information on how to configure queries for the data sources listed above, refer to the documentation for specific data source.

## Query editor

You can query and search tracing data using a data source's query editor.

Each data source can have it's own query editor. The query editor for the Tempo data source is slightly different than the query editor for the Jaeger data source.

For information on querying each data source, refer to their documentation:

- [Tempo query editor]({{< relref "../datasources/tempo/query-editor" >}})
- [Jaeger query editor]({{< relref "../datasources/jaeger/#query-the-data-source" >}})
- [Zipkin query editor]({{< relref "../datasources/zipkin/#query-the-data-source" >}})
- [Azure Monitor Application Insights query editor]({{< relref "../datasources/azure-monitor/query-editor/#query-application-insights-traces" >}})
- [ClickHouse query editor](https://clickhouse.com/docs/en/integrations/grafana/query-builder#traces)

## Trace view

This section explains the elements of the Trace View.

{{< figure src="/media/docs/tempo/screenshot-grafana-trace-view.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the trace view" >}}

### Header

{{< figure src="/media/docs/tempo/screenshot-grafana-trace-view-header.png" class="docs-image--no-shadow" max-width= "750px" caption="Screenshot of the trace view header" >}}

- Header title: Shows the name of the root span and trace ID.
- Search: Highlights spans containing the searched text.
- Metadata: Various metadata about the trace.

### Minimap

{{< figure src="/media/docs/tempo/screenshot-grafana-trace-view-minimap.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the trace view minimap" >}}

Shows condensed view or the trace timeline. Drag your mouse over the minimap to zoom into smaller time range. Zooming will also update the main timeline, so it is easy to see shorter spans. Hovering over the minimap, when zoomed, will show Reset Selection button which resets the zoom.

### Span filters

![Screenshot of span filtering](/media/docs/tempo/screenshot-grafana-tempo-span-filters-v10-1.png)

Using span filters, you can filter your spans in the trace timeline viewer. The more filters you add, the more specific are the filtered spans.

You can add one or more of the following filters:

- Resource service name
- Span name
- Duration
- Tags (which include tags, process tags, and log fields)

To only show the spans you have matched, you can press the `Show matches only` toggle.

{{< youtube id="VP2XV3IIc80" >}}

### Timeline

{{< figure src="/media/docs/tempo/screenshot-grafana-trace-view-timeline.png" class="docs-image--no-shadow" max-width= "900px"  caption="Screenshot of the trace view timeline" >}}

Shows list of spans within the trace. Each span row consists of these components:

- Expand children button: Expands or collapses all the children spans of selected span.
- Service name: Name of the service logged the span.
- Operation name: Name of the operation that this span represents.
- Span duration bar: Visual representation of the operation duration within the trace.

Clicking anywhere on the span row shows span details.

### Span details

{{< figure src="/media/docs/tempo/screenshot-grafana-trace-view-span-details.png" class="docs-image--no-shadow" max-width= "900px"  caption="Screenshot of the trace view span details" >}}

- Operation name.
- Span metadata.
- Tags: Any tags associated with this span.
- Process metadata: Metadata about the process that logged this span.
- Logs: List of logs logged by this span and associated key values. In case of Zipkin logs section shows Zipkin annotations.

### Trace to logs

You can navigate from a span in a trace view directly to logs relevant for that span. This feature is available for Tempo, Jaeger, and Zipkin data sources. Refer to their [relevant documentation](/docs/grafana/latest/datasources/tempo/#trace-to-logs) for configuration instructions.

{{< figure src="/media/docs/tempo/screenshot-grafana-trace-view-trace-to-logs.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the trace view in Explore with icon next to the spans" >}}

Click the document icon to open a split view in Explore with the configured data source and query relevant logs for the span.

### Trace to metrics

{{% admonition type="note" %}}
This feature is currently in beta and behind the `traceToMetrics` feature toggle.
{{% /admonition %}}

You can navigate from a span in a trace view directly to metrics relevant for that span. This feature is available for Tempo, Jaeger, and Zipkin data sources. Refer to their [relevant documentation](/docs/grafana/latest/datasources/tempo/configure-tempo-data-source/#trace-to-metrics) for configuration instructions.

### Trace to profiles

Using Trace to profiles, you can use Grafana’s ability to correlate different signals by adding the functionality to link between traces and profiles.
Refer to the [relevant documentation](/docs/grafana/latest/datasources/tempo/configure-tempo-data-source#trace-to-profiles) for configuration instructions.

{{< figure src="/static/img/docs/tempo/profiles/tempo-trace-to-profile.png" max-width="900px" class="docs-image--no-shadow" alt="Selecting a link in the span queries the profile data source" >}}

## Node graph

You can optionally expand the node graph for the displayed trace. Depending on the data source, this can show spans of the trace as nodes in the graph, or as some additional context like service graph based on the current trace.

{{< figure src="/media/docs/tempo/screenshot-grafana-node-graph.png" class="docs-image--no-shadow" max-width= "900px"  caption="Screenshot of the node graph" >}}

## Service Graph

The Service Graph visualizes the span metrics (traces data for rates, error rates, and durations (RED)) and service graphs.
Once the requirements are set up, this pre-configured view is immediately available.

For more information, refer to the [Service Graph view section]({{< relref "../datasources/tempo/#open-the-service-graph-view" >}}) of the Tempo data source page and the [service graph view page](/docs/tempo/latest/metrics-generator/service-graph-view/) in the Tempo documentation.

{{< figure src="/static/img/docs/grafana-cloud/apm-overview.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the Service Graph view" >}}

## Data API

This visualization needs a specific shape of the data to be returned from the data source in order to correctly display it.

Data source needs to return data frame and set `frame.meta.preferredVisualisationType = 'trace'`.

### Data frame structure

Required fields:

| Field name   | Type                | Description                                                                                                                         |
| ------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| traceID      | string              | Identifier for the entire trace. There should be only one trace in the data frame.                                                  |
| spanID       | string              | Identifier for the current span. SpanIDs should be unique per trace.                                                                |
| parentSpanID | string              | SpanID of the parent span to create child parent relationship in the trace view. Can be `undefined` for root span without a parent. |
| serviceName  | string              | Name of the service this span is part of.                                                                                           |
| serviceTags  | TraceKeyValuePair[] | List of tags relevant for the service.                                                                                              |
| startTime    | number              | Start time of the span in millisecond epoch time.                                                                                   |
| duration     | number              | Duration of the span in milliseconds.                                                                                               |

Optional fields:

| Field name     | Type                | Description                                                        |
| -------------- | ------------------- | ------------------------------------------------------------------ |
| logs           | TraceLog[]          | List of logs associated with the current span.                     |
| tags           | TraceKeyValuePair[] | List of tags associated with the current span.                     |
| warnings       | string[]            | List of warnings associated with the current span.                 |
| stackTraces    | string[]            | List of stack traces associated with the current span.             |
| errorIconColor | string              | Color of the error icon in case span is tagged with `error: true`. |

For details about the types see [TraceSpanRow](https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/types/trace.ts#L28), [TraceKeyValuePair](https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/types/trace.ts#L4) and [TraceLog](https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/types/trace.ts#L12).
