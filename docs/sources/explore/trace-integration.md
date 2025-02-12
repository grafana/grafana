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
weight: 40
---

# Traces in Explore

You can use Explore to query and visualize traces from tracing data sources. Supported data sources include:

- [Tempo](/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/)
- [Jaeger](/docs/grafana/<GRAFANA_VERSION>/datasources/jaeger/)
- [Zipkin](/docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/)
- [X-Ray](https://grafana.com/grafana/plugins/grafana-x-ray-datasource)
- [Azure Monitor](/docs/grafana/latest/datasources/azure-monitor/)
- [ClickHouse](https://github.com/grafana/clickhouse-datasource)
- [New Relic](/docs/plugins/grafana-newrelic-datasource/latest/)
- [Infinity](/docs/plugins/yesoreyeram-infinity-datasource/latest/)

Here are some references to learn more about traces and how you can use them:

- [Introduction to tracing](https://grafana.com/docs/tempo/<TEMPO_VERSION>/introduction/)
- [Trace structure](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql/trace-structure/#trace-structure)
- [Traces and telemetry](https://grafana.com/docs/tempo/<TEMPO_VERSION>/introduction/telemetry/)
- [Using traces to find solutions to problems](https://grafana.com/docs/tempo/<TEMPO_VERSION>/introduction/solutions-with-traces/)
- [Best practices for tracing](/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/tracing-best-practices/)

## Query editors

You can query and search tracing data using a data source's query editor. Note that data sources in Grafana have unique query editors.

For information on how to use the query editor to create queries for tracing data sources, refer to the documentation for each individual data source.

## Trace view

Grafana's trace view provides an overview of a request as it travels through your system. The following sections provide detail on various elements of the trace view.

{{< figure src="/media/docs/tempo/screenshot-grafana-trace-view.png" class="docs-image--no-shadow" max-width= "900px" caption="Trace view" >}}

### Header

The trace view header includes the following:

- **Header title** - Shows the name of the root span and trace ID.
- **Search** - Highlights spans containing the searched text.
- **Metadata** - Various metadata about the trace.

{{< figure src="/media/docs/tempo/screenshot-grafana-trace-view-header.png" class="docs-image--no-shadow" max-width= "750px" caption="Trace view header" >}}

### Minimap

**Minimap** displays a condensed view of the trace timeline. Drag your mouse over the minimap to zoom into a smaller time range. This also updates the main timeline, making it easier to view shorter spans
When zoomed in, hovering over the minimap displays **Reset selection**, which resets the zoom.

{{< figure src="/media/docs/tempo/screenshot-grafana-trace-view-minimap.png" class="docs-image--no-shadow" max-width= "900px" caption="Trace view minimap example" >}}

### Timeline

Timeline shows list of spans within the trace. Each span row consists of the following components:

- **Expand children** - Expands or collapses all the children spans of the selected span.
- **Service name** - Name of the service logged the span.
- **Operation name** - Name of the operation that this span represents.
- **Span duration bar** - Visual representation of the operation duration within the trace.

Click anywhere on the span row to reveal span details.

{{< figure src="/media/docs/tempo/screenshot-grafana-trace-view-timeline.png" class="docs-image--no-shadow" max-width= "900px"  caption="Trace view timeline" >}}

### Span details

Traces are composed of one or more spans.
A span is a unit of work within a trace that has a start time relative to the beginning of the trace, a duration and an operation name for the unit of work.
It usually has a reference to a parent span, unless it’s the first span, the root span, in a trace.
It frequently includes key/value attributes that are relevant to the span itself, for example the HTTP method used in the request, as well as other metadata such as the service name, sub-span events, or links to other spans.

You can expand any span in a trace and view the details, including the span and resource attributes.

For more information about spans and traces, refer to [Introduction to tracing](https://grafana.com/docs/tempo/latest/introduction/) in the Tempo documentation.

Span details include:

- **Span attributes** - Key/value pairs that provides context for spans. For example, if the span deals with calling another service via HTTP, an attribute could include the HTTP URL (maybe as the span attribute key `http.url`) and the HTTP status code returned (as the span attribute `http.status_code`).

- **Resource attributes** - Key/value pairs that describe the context of how the span was collected.

Refer to [Span and resource attributes](/docs/tempo/<TEMPO_VERSION>/operations/best-practices/#span-and-resource-attributes) for more detail.

{{< figure src="/media/docs/tempo/screenshot-grafana-trace-view-span-details.png" class="docs-image--no-shadow" max-width= "900px"  caption="Trace view span details" >}}

### Span filters

Span filters allow you to refine the spans displayed in the trace timeline viewer.
The more filters you add, the more specific the filtered spans become.
Click on a trace to access Span filters.

![Screenshot of span filtering](/media/docs/tempo/screenshot-grafana-tempo-span-filters-v10-1.png)

You can add one or more of the following filters:

- **Service name** - Filter by selecting a service name from the dropdown.
- **Span name** - Filter by selecting a span name from the dropdown.
- **Duration** - Filter by duration. Accepted units include ns, us, ms, s, m, h.
- **Tags** - Filter by tags, process tags, or log fields in your span.

To only show the spans you have matched, toggle **Show matches only**.

Refer to [Span filters](/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/span-filters/) for more in depth information.

Watch the following video to learn more about filtering trace spans in Grafana:
{{< youtube id="VP2XV3IIc80" >}}

### Trace to logs

You can navigate from a span in a trace view directly to logs relevant for that span.
This feature is available for the Tempo, Jaeger, and Zipkin data sources.
Refer to each individual data source's documentation for configuration instructions.

Click the document icon to open a split view in Explore with the configured data source and query relevant logs for the span.

{{< figure src="/media/docs/tempo/screenshot-grafana-trace-view-trace-to-logs.png" class="docs-image--no-shadow" max-width= "900px" caption="Trace to logs" >}}

### Trace to metrics

You can navigate from a span in a trace view directly to metrics relevant for that span.
This feature is available for the Tempo, Jaeger, and Zipkin data sources.

Refer to each individual data source's documentation for configuration instructions.
For Tempo, refer to [Trace to metrics configuration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/#trace-to-metrics).

### Trace to profiles

Using Trace to profiles, you can use Grafana’s ability to correlate different signals by adding the functionality to link between traces and profiles.

For Tempo refer to [Trace to profiles](/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source#trace-to-profiles) for configuration instructions.

{{< figure src="/static/img/docs/tempo/profiles/tempo-trace-to-profile.png" max-width="900px" class="docs-image--no-shadow" alt="Selecting a link in the span queries the profile data source" >}}

## Node graph

You can also expand the node graph for a displayed trace. If the data source supports it, this displays spans of the trace as nodes in the graph, or provides additional context, such as a service graph based on the current trace.

Refer to [Node graph](/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/node-graph/) for additional information.

{{< admonition type="note" >}}
The node graph requires data to be returned from the data source in a specific format to display correctly. Refer to [Data API](/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/node-graph/#data-api), [Nodes data frame structure](/docs/grafana/latest/panels-visualizations/visualizations/node-graph/#nodes-data-frame-structure) and [Node graph data requirements](/docs/grafana/latest/panels-visualizations/visualizations/node-graph/#data-requirements) for additional information and configuration instructions.
{{< /admonition >}}

{{< figure src="/media/docs/tempo/screenshot-grafana-node-graph.png" class="docs-image--no-shadow" max-width= "900px"  caption="Node graph" >}}

## Service graph

A service graph visualizes rates, error rates, and durations (RED), along with service relationships.
After the requirements are configured, this pre-configured view is immediately available.

For additional information refer to the following documentation:

- [Service Graph and Service Graph view](/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/service-graph/)
- [Service graph view](/docs/tempo/<TEMPO_VERSION>/metrics-generator/service-graph-view/) in Tempo documentation

{{< figure src="/static/img/docs/grafana-cloud/apm-overview.png" class="docs-image--no-shadow" max-width= "900px" caption="Service graph view" >}}
