---
description: Tracing in Explore
keywords:
  - explore
  - trace
title: Tracing in Explore
weight: 20
---

# Tracing in Explore

Explore allows you to visualize traces from tracing data sources. This is available in Grafana v7.0+.

Supported data sources are:

- [Jaeger]({{< relref "../datasources/jaeger.md" >}})
- [Tempo]({{< relref "../datasources/tempo.md" >}})
- [X-Ray](https://grafana.com/grafana/plugins/grafana-x-ray-datasource)
- [Zipkin]({{< relref "../datasources/zipkin.md" >}})

For information on how to configure queries for the data sources listed above, refer to the documentation for specific data source.

{{< figure src="/static/img/docs/explore/explore-trace-view-full-8-0.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the trace view" >}}

##### Header

{{< figure src="/static/img/docs/v70/explore-trace-view-header.png" class="docs-image--no-shadow" max-width= "750px" caption="Screenshot of the trace view header" >}}

- Header title: Shows the name of the root span and trace ID.
- Search: Highlights spans containing the searched text.
- Metadata: Various metadata about the trace.

##### Minimap

{{< figure src="/static/img/docs/v70/explore-trace-view-minimap.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the trace view minimap" >}}

Shows condensed view or the trace timeline. Drag your mouse over the minimap to zoom into smaller time range. Zooming will also update the main timeline, so it is easy to see shorter spans. Hovering over the minimap, when zoomed, will show Reset Selection button which resets the zoom.

##### Timeline

{{< figure src="/static/img/docs/v70/explore-trace-view-timeline.png" class="docs-image--no-shadow" max-width= "900px"  caption="Screenshot of the trace view timeline" >}}

Shows list of spans within the trace. Each span row consists of these components:

- Expand children button: Expands or collapses all the children spans of selected span.
- Service name: Name of the service logged the span.
- Operation name: Name of the operation that this span represents.
- Span duration bar: Visual representation of the operation duration within the trace.

Clicking anywhere on the span row shows span details.

##### Span details

{{< figure src="/static/img/docs/v70/explore-trace-view-span-details.png" class="docs-image--no-shadow" max-width= "900px"  caption="Screenshot of the trace view span details" >}}

- Operation name
- Span metadata
- Tags: Any tags associated with this span.
- Process metadata: Metadata about the process that logged this span.
- Logs: List of logs logged by this span and associated key values. In case of Zipkin logs section shows Zipkin annotations.

##### Node graph

You can optionally expand the node graph for the displayed trace. Depending on the data source, this can show spans of the trace as nodes in the graph, or as some additional context like service graph based on the current trace.

![Node graph](/static/img/docs/explore/explore-trace-view-node-graph-8-0.png 'Node graph')

##### Trace to logs

> **Note:** Available in Grafana 7.4 and later versions.

You can navigate from a span in a trace view directly to logs relevant for that span. This is available for Tempo, Jaeger, and Zipkin data sources at this moment. Refer to their relevant documentation for instructions on how to configure this feature.

{{< figure src="/static/img/docs/explore/trace-to-log-7-4.png" class="docs-image--no-shadow" max-width= "600px"  caption="Screenshot of the trace view in Explore with icon next to the spans" >}}

Click the document icon to open a split view in Explore with the configured data source and query relevant logs for the span.

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

For details about the types see [TraceSpanRow](https://grafana.com/docs/grafana/latest/packages_api/data/tracespanrow/), [TraceKeyValuePair](https://grafana.com/docs/grafana/latest/packages_api/data/tracekeyvaluepair/) and [TraceLog](https://grafana.com/docs/grafana/latest/packages_api/data/tracelog/)
