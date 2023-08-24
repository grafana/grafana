+++
title = "Tempo"
description = "High volume, minimal dependency trace storage. OSS tracing solution from Grafana Labs."
keywords = ["grafana", "tempo", "guide", "tracing"]
aliases = ["/docs/grafana/v8.1/features/datasources/tempo"]
weight = 1400
+++

# Tempo data source

Grafana ships with built-in support for Tempo a high volume, minimal dependency trace storage, OSS tracing solution from Grafana Labs. Add it as a data source, and you are ready to query your traces in [Explore]({{< relref "../explore/_index.md" >}}).

## Add data source

To access Tempo settings, click the **Configuration** (gear) icon, then click **Data Sources** > **Tempo**.

| Name         | Description                                                                             |
| ------------ | --------------------------------------------------------------------------------------- |
| `Name`       | The name using which you will refer to the data source in panels, queries, and Explore. |
| `Default`    | The default data source will be pre-selected for new panels.                            |
| `URL`        | The URL of the Tempo instance, e.g., `http://tempo`                                     |
| `Basic Auth` | Enable basic authentication to the Tempo data source.                                   |
| `User`       | User name for basic authentication.                                                     |
| `Password`   | Password for basic authentication.                                                      |

### Trace to logs

> **Note:** This feature is available in Grafana 7.4+.

This is a configuration for the [trace to logs feature]({{< relref "../explore/trace-integration" >}}). Select target data source (at this moment limited to Loki data sources) and select which tags will be used in the logs query.

- **Data source -** Target data source.
- **Tags -** The tags that will be used in the Loki query. Default is `'cluster', 'hostname', 'namespace', 'pod'`.
- **Span start time shift -** Shift in the start time for the Loki query based on the span start time. In order to extend to the past, you need to use a negative value. Time units can be used here, for example, 5s, 1m, 3h. The default is 0.
- **Span end time shift -** Shift in the end time for the Loki query based on the span end time. Time units can be used here, for example, 5s, 1m, 3h. The default is 0.

![Trace to logs settings](/static/img/docs/explore/trace-to-logs-settings-8.png 'Screenshot of the trace to logs settings')

## Query traces

You can query and display traces from Tempo via [Explore]({{< relref "../explore/_index.md" >}}).
You can search for traces if you set up the trace to logs setting in the data source configuration page. To find traces to visualize, use the [Loki query editor]({{< relref "loki.md#loki-query-editor" >}}). To get search results, you must have [derived fields]({{< relref "loki.md#derived-fields" >}}) configured, which point to this data source.

{{< figure src="/static/img/docs/tempo/query-editor-search.png" class="docs-image--no-shadow" caption="Screenshot of the Tempo query editor showing the search tab" >}}

To query a particular trace, select the **TraceID** query type, and then put the ID into the Trace ID field.

{{< figure src="/static/img/docs/tempo/query-editor-traceid.png" class="docs-image--no-shadow" caption="Screenshot of the Tempo TraceID query type" >}}

## Linking Trace ID from logs

You can link to Tempo trace from logs in Loki or Elastic by configuring an internal link. See the [Derived fields]({{< relref "loki.md#derived-fields" >}}) section in the [Loki data source]({{< relref "loki.md" >}}) or [Data links]({{< relref "elasticsearch.md#data-links" >}}) section in the [Elastic data source]({{< relref "elasticsearch.md" >}}) for configuration instructions.
