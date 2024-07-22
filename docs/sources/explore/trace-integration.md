---
keywords:
  - explore
  - trace
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Traces in Explore
weight: 20
---

# Traces in Explore

You can use Explore to query and visualize traces from tracing data sources. Supported data sources include:

- [Tempo]({{< relref "../datasources/tempo/" >}}) (supported ingestion formats: OpenTelemetry, Jaeger, and Zipkin)
- [Jaeger]({{< relref "../datasources/jaeger/" >}})
- [Zipkin]({{< relref "../datasources/zipkin/" >}})
- [X-Ray](https://grafana.com/grafana/plugins/grafana-x-ray-datasource)
- [Azure Monitor Application Insights]({{< relref "../datasources/azure-monitor/" >}})
- [ClickHouse](https://github.com/grafana/clickhouse-datasource)
- [New Relic](https://grafana.com/grafana/plugins/grafana-newrelic-datasource)
- [Infinity](https://grafana.com/grafana/plugins/yesoreyeram-infinity-datasource)

## Query editors

You can query and search tracing data using a data source's query editor. Note that data sources in Grafana have unique query editors.

For information on how to configure queries for these data sources, refer to the documentation for each individual data source.

<!-- - [Tempo query editor]({{< relref "../datasources/tempo/query-editor" >}})
- [Jaeger query editor]({{< relref "../datasources/jaeger/#query-the-data-source" >}})
- [Zipkin query editor]({{< relref "../datasources/zipkin/#query-the-data-source" >}})
- [Azure Monitor Application Insights query editor]({{< relref "../datasources/azure-monitor/query-editor/#query-application-insights-traces" >}})
- [ClickHouse query editor](https://clickhouse.com/docs/en/integrations/grafana/query-builder#traces)
- [New Relic](https://grafana.com/docs/plugins/grafana-newrelic-datasource/<GRAFANA_VERSION>/#query-the-data-source) -->

## Trace view

The following sections provide information on Grafana's Trace View.

{{< figure src="/media/docs/tempo/screenshot-grafana-trace-view.png" class="docs-image--no-shadow" max-width= "900px" caption="Trace view" >}}

Learn more about how to use traces to troubleshoot issues by reading [Use traces to find solutions](https://grafana.com/docs/tempo/<TEMPO_VERSION>/introduction/solutions-with-traces/).

### Header

The trace view header includes the following:

- **Header title -** Shows the name of the root span and trace ID.
- **Search -** Highlights spans containing the searched text.
- **Metadata -** Various metadata about the trace.

{{< figure src="/media/docs/tempo/screenshot-grafana-trace-view-header.png" class="docs-image--no-shadow" max-width= "750px" caption="Trace view header example" >}}

### Minimap

**Minimap**m displays a condensed view of the trace timeline. Drag your mouse over the minimap to zoom into a smaller time range. This also updates the main timeline, making it easier to view shorter spans
When zoomed in, hovering over the minimap displays the **Reset selectio** button, which resets the zoom.

{{< figure src="/media/docs/tempo/screenshot-grafana-trace-view-minimap.png" class="docs-image--no-shadow" max-width= "900px" caption="Trace view minimap example" >}}

### Span filters

Span filters allow you to refine the spans displayed in the trace timeline viewer. The more filters you add, the more specific the filtered spans become. Click on a trace to access Span filters.

![Screenshot of span filtering](/media/docs/tempo/screenshot-grafana-tempo-span-filters-v10-1.png)

You can add one or more of the following filters:

- **Service name -** Filter by selecting a service name from the dropdown.
- **Span name -** Filter by selecting a span name from the dropdown.
- **Duration -** Filter by duration. Accepted units include ns, us, ms, s, m, h.
- **Tags -** Filter by tags, process tags, or log fields in your span.

To only show the spans you have matched, toggle **Show matches only**.

Refer to [Span filters](/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/span-filters/) for more in depth information on working with span filters.

Watch the following video to learn more about filtering trace spans in Grafana:
{{< youtube id="VP2XV3IIc80" >}}

### Timeline

Timeline shows list of spans within the trace. Each span row consists of the following components:

- **Expand children -** Expands or collapses all the children spans of the selected span.
- **Service name -** Name of the service logged the span.
- **Operation name -** Name of the operation that this span represents.
- **Span duration bar -** Visual representation of the operation duration within the trace.

Clicking anywhere on the span row shows span details.

{{< figure src="/media/docs/tempo/screenshot-grafana-trace-view-timeline.png" class="docs-image--no-shadow" max-width= "900px"  caption="Trace view timeline" >}}

### Span details

Traces are composed of one or more spans. A span is a unit of work within a trace that has a start time relative to the beginning of the trace, a duration and an operation name for the unit of work. It usually has a reference to a parent span (unless it’s the first span, the root span, in a trace). It frequently includes key/value attributes that are relevant to the span itself, for example the HTTP method used in the request, as well as other metadata such as the service name, sub-span events, or links to other spans.

You can expand any span in a trace and view the details, including the span and resource attributes.

For more information about spans and traces, refer to [Introduction to tracing](https://grafana.com/docs/tempo/latest/introduction/) in the Tempo documentation.

{{< figure src="/media/docs/tempo/screenshot-grafana-trace-view-span-details.png" class="docs-image--no-shadow" max-width= "900px"  caption="Trace view span details" >}}

<!-- - Operation name.
- Span metadata.
- Tags: Any tags associated with this span.
- Process metadata: Metadata about the process that logged this span.
- Logs: List of logs logged by this span and associated key values. In case of Zipkin logs section shows Zipkin annotations. -->

### Trace to logs

You can navigate from a span in a trace view directly to logs relevant for that span. This feature is available for the Tempo, Jaeger, and Zipkin data sources. Refer to their [relevant documentation](/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/#trace-to-logs) for configuration instructions.

{{< figure src="/media/docs/tempo/screenshot-grafana-trace-view-trace-to-logs.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the trace view in Explore with icon next to the spans" >}}

Click the document icon to open a split view in Explore with the configured data source and query relevant logs for the span.

### Trace to metrics

You can navigate from a span in a trace view directly to metrics relevant for that span. This feature is available for the Tempo, Jaeger, and Zipkin data sources. Refer to their [relevant documentation](/docs/grafana/latest/datasources/tempo/configure-tempo-data-source/#trace-to-metrics) for configuration instructions.

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
