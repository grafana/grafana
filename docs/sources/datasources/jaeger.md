+++
title = "Jaeger"
description = "Guide for using Jaeger in Grafana"
keywords = ["grafana", "jaeger", "guide", "tracing"]
aliases = ["/docs/grafana/v7.4/features/datasources/jaeger"]
weight = 800
+++

# Jaeger data source

Grafana ships with built-in support for Jaeger, which provides open source, end-to-end distributed tracing.
Just add it as a data source and you are ready to query your traces in [Explore]({{< relref "../explore/_index.md" >}}).

## Add data source

To access Jaeger settings, click the **Configuration** (gear) icon, then click **Data Sources** > **Jaeger**.

| Name         | Description                                                            |
| ------------ | ---------------------------------------------------------------------- |
| `Name`       | The data source name in panels, queries, and Explore.                  |
| `Default`    | The pre-selected data source for a new panel.                          |
| `URL`        | The URL of the Jaeger instance. For example, `http://localhost:16686`. |
| `Basic Auth` | Enable basic authentication for the Jaeger data source.                |
| `User`       | Specify a user name for basic authentication.                          |
| `Password`   | Specify a password for basic authentication.                           |

### Trace to logs

> **Note:** This feature is available in Grafana 7.4+.

This is a configuration for the [trace to logs feature]({{< relref "../explore/trace-integration" >}}). Select target data source (at this moment limited to Loki data sources) and select which tags will be used in the logs query.

- **Data source -** Target data source.
- **Tags -** The tags that will be used in the Loki query. Default is `'cluster', 'hostname', 'namespace', 'pod'`.

![Trace to logs settings](/static/img/docs/explore/trace-to-logs-settings-7-4.png "Screenshot of the trace to logs settings")

## Query traces

You can query and display traces from Jaeger via [Explore]({{< relref "../explore/_index.md" >}}).

{{< figure src="/static/img/docs/v70/jaeger-query-editor.png" class="docs-image--no-shadow" caption="Screenshot of the Jaeger query editor" >}}

The Jaeger query editor allows you to query by trace ID directly or selecting a trace from trace selector. To query by trace ID, insert the ID into the text input.

{{< figure src="/static/img/docs/v70/jaeger-query-editor-open.png" class="docs-image--no-shadow" caption="Screenshot of the Jaeger query editor with trace selector expanded" >}}

Use the trace selector to pick particular trace from all traces logged in the time range you have selected in Explore. The trace selector has three levels of nesting:

1. The service you are interested in.
1. Particular operation is part of the selected service.
1. Specific trace in which the selected operation occurred, represented by the root operation name and trace duration.

## Linking Trace ID from logs

You can link to Jaeger trace from logs in Loki by configuring a derived field with internal link. See the [Derived fields]({{< relref "loki.md#derived-fields" >}}) section in the [Loki data source]({{< relref "loki.md" >}}) documentation for details.
