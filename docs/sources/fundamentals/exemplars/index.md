---
aliases:
  - ../basics/exemplars/
  - ../basics/exemplars/view-exemplars/
description: Exemplars
keywords:
  - grafana
  - concepts
  - exemplars
  - prometheus
title: Exemplars
weight: 750
---

# Introduction to exemplars

An exemplar is a specific trace representative of measurement taken in a given time interval. While metrics excel at giving you an aggregated view of your system, traces give you a fine grained view of a single request; exemplars are a way to link the two.

Suppose your company website is experiencing a surge in traffic volumes. While more than eighty percent of the users are able to access the website in under two seconds, some users are experiencing a higher than normal response time resulting in bad user experience.

To identify the factors that are contributing to the latency, you must compare a trace for a fast response against a trace for a slow response. Given the vast amount of data in a typical production environment, it will be extremely laborious and time-consuming effort.

Use exemplars to help isolate problems within your data distribution by pinpointing query traces exhibiting high latency within a time interval. Once you localize the latency problem to a few exemplar traces, you can combine it with additional system based information or location properties to perform a root cause analysis faster, leading to quick resolutions to performance issues.

Support for exemplars is available for the Prometheus data source only. Once you enable the functionality, exemplars data is available by default. For more information on exemplar configuration and how to enable exemplars, refer to [configuring exemplars in Prometheus data source]({{< relref "../../datasources/prometheus/#configuring-exemplars" >}}).

Grafana shows exemplars alongside a metric in the Explore view and in dashboards. Each exemplar displays as a highlighted star. You can hover your cursor over an exemplar to view the unique traceID, which is a combination of a key value pair. To investigate further, click the blue button next to the `traceID` property.

{{< figure src="/media/docs/grafana/exemplars/screenshot-exemplars.png" class="docs-image--no-shadow" max-width= "750px" caption="Screenshot showing the detail window of an exemplar" >}}

Refer to [View exemplar data]({{< relref "#view-exemplar-data" >}}) for instructions on how to drill down and view exemplar trace details from metrics and logs. To know more about exemplars, refer to the blogpost [Intro to exemplars, which enable Grafana Tempo’s distributed tracing at massive scale](https://grafana.com/blog/2021/03/31/intro-to-exemplars-which-enable-grafana-tempos-distributed-tracing-at-massive-scale/).

## View exemplar data

When support for exemplar support is enabled for a Prometheus data source, you can view exemplar data either in the Explore view or from the Loki log details.

### In Explore

Explore visualizes exemplar traces as highlighted stars alongside metrics data. For more information on how Explore visualizes trace data, refer to [Tracing in Explore]({{< relref "../../explore/trace-integration/" >}}).

To examine the details of an exemplar trace:

1. Place your cursor over an exemplar (highlighted star). Depending on your backend trace data source, you will see a blue button with the label `Query with <data source name>`. In the following example, the tracing data source is Tempo.

   {{< figure src="/media/docs/grafana/exemplars/screenshot-exemplar-details.png" class="docs-image--no-shadow" max-width= "350px" caption="Screenshot showing exemplar details" >}}

1. Click the **Query with Tempo** option next to the `traceID` property. The trace details, including the spans within the trace are listed in a separate panel on the right.

   {{< figure src="/media/docs/grafana/exemplars/screenshot-exemplar-explore-view.png" class="docs-image--no-shadow" max-width= "900px" caption="Explorer view with panel showing trace details" >}}

For more information on how to drill down and analyze the trace and span details, refer to the [Analyze trace and span details](#analyze-trace-and-spans) section.

### In logs

You can also view exemplar trace details from the Loki logs in Explore. Use regex within the Derived fields links for Loki to extract the `traceID` information. Now when you expand Loki logs, you can see a `traceID` property under the **Detected fields** section. To learn more about how to extract a part of a log message into an internal or external link, refer to [using derived fields in Loki]({{< relref "../../explore/logs-integration/" >}}).

To view the details of an exemplar trace:

1. Expand a log line and scroll down to the `Fields` section. Depending on your backend trace data source, you will see a blue button with the label `<data source name>`.

1. Click the blue button next to the `traceID` property. Typically, it will have the name of the backend data source. In the following example, the tracing data source is Tempo. The trace details, including the spans within the trace are listed in a separate panel on the right.

{{< figure src="/media/docs/grafana/exemplars/screenshot-exemplar-loki-logs.png" class="docs-image--no-shadow" max-width= "750px" caption="Explorer view with panel showing trace details" >}}

For more information on how to drill down and analyze the trace and span details, refer to the [Analyze trace and span details](#analyze-trace-and-spans) section.

### Analyze trace and spans

This panel shows the details of the trace in different segments.

- The top segment shows the Trace ID to indicate that the query results correspond to the specific trace.

  You can add more traces to the results using the `Add query` button.

- The next segment shows the entire span for the specific trace as a narrow strip. All levels of the trace from the client all the way down to database query is displayed, which provides a bird's eye view of the time distribution across all layers over which the HTTP request was processed.

  1. You can click within this strip view to display a magnified view of a smaller time segment within the span. This magnified view shows up in the bottom segment of the panel.

  1. In the magnified view, you can expand or collapse the various levels of the trace to drill down to the specific span of interest.

     For example, if the strip view shows that most of the latency was within the app layer, you can expand the trace down the app layer to investigate the problem further. To expand a particular layer of span, click the icon on the left. The same button can collapse an expanded span.

- To see the details of the span at any level, click the span itself.

  This displays additional metadata associated with the span. The metadata itself is initially shown in a narrow strip but you can see more details by clicking the metadata strip.

  {{< figure src="/media/docs/grafana/exemplars/screenshot-exemplar-span-details.png" class="docs-image--no-shadow" max-width= "600px" caption="Span details" >}}
