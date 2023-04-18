---
description: Guide for using Zipkin in Grafana
keywords:
  - grafana
  - zipkin
  - guide
  - tracing
title: Zipkin
weight: 1600
---

# Zipkin data source

Grafana ships with built-in support for Zipkin, an open source, distributed tracing system.
Just add it as a data source and you are ready to query your traces in [Explore]({{< relref "../explore" >}}).

## Adding the data source

To access Zipkin settings, click the **Configuration** (gear) icon, then click **Data Sources** > **Zipkin**.

| Name         | Description                                                           |
| ------------ | --------------------------------------------------------------------- |
| `Name`       | The data source name in panels, queries, and Explore.                 |
| `Default`    | The pre-selected data source for a new panel.                         |
| `URL`        | The URL of the Zipkin instance. For example, `http://localhost:9411`. |
| `Basic Auth` | Enable basic authentication for the Zipkin data source.               |
| `User`       | Specify a user name for basic authentication.                         |
| `Password`   | Specify a password for basic authentication.                          |

### Trace to logs

> **Note:** This feature is available in Grafana 7.4+.

This is a configuration for the [trace to logs feature]({{< relref "../explore/trace-integration" >}}). Select target data source (at this moment limited to Loki data sources) and select which tags will be used in the logs query.

- **Data source -** Target data source.
- **Tags -** The tags that will be used in the Loki query. Default is `'cluster', 'hostname', 'namespace', 'pod'`.
- **Map tag names -** When enabled, allows configuring how Zipkin tag names map to Loki label names. For example, map `service.name` to `service`.
- **Span start time shift -** Shift in the start time for the Loki query based on the span start time. In order to extend to the past, you need to use a negative value. Use time interval units like 5s, 1m, 3h. The default is 0.
- **Span end time shift -** Shift in the end time for the Loki query based on the span end time. Time units can be used here, for example, 5s, 1m, 3h. The default is 0.
- **Filter by Trace ID -** Toggle to append the trace ID to the Loki query.
- **Filter by Span ID -** Toggle to append the span ID to the Loki query.

![Trace to logs settings](/static/img/docs/explore/trace-to-logs-settings-8-2.png 'Screenshot of the trace to logs settings')

### Node Graph

This is a configuration for the beta Node Graph visualization. The Node Graph is shown after the trace view is loaded and is disabled by default.

-- **Enable Node Graph -** Enables the Node Graph visualization.

## Query traces

Querying and displaying traces from Zipkin is available via [Explore]({{< relref "../explore" >}}).

{{< figure src="/static/img/docs/v70/zipkin-query-editor.png" class="docs-image--no-shadow" caption="Screenshot of the Zipkin query editor" >}}

The Zipkin query editor allows you to query by trace ID directly or selecting a trace from trace selector. To query by trace ID, insert the ID into the text input.

{{< figure src="/static/img/docs/v70/zipkin-query-editor-open.png" class="docs-image--no-shadow" caption="Screenshot of the Zipkin query editor with trace selector expanded" >}}

Use the trace selector to pick particular trace from all traces logged in the time range you have selected in Explore. The trace selector has three levels of nesting:

1. The service you are interested in.
1. Particular operation is part of the selected service
1. Specific trace in which the selected operation occurred, represented by the root operation name and trace duration.

## Data mapping in the trace UI

Zipkin annotations are shown in the trace view as logs with annotation value shown under annotation key.

## Upload JSON trace file

You can upload a JSON file that contains a single trace to visualize it.

{{< figure src="/static/img/docs/explore/zipkin-upload-json.png" class="docs-image--no-shadow" caption="Screenshot of the Zipkin data source in explore with upload selected" >}}

Here is an example JSON:

```json
[
  {
    "traceId": "efe9cb8857f68c8f",
    "parentId": "efe9cb8857f68c8f",
    "id": "8608dc6ce5cafe8e",
    "kind": "SERVER",
    "name": "get /api",
    "timestamp": 1627975249601797,
    "duration": 23457,
    "localEndpoint": { "serviceName": "backend", "ipv4": "127.0.0.1", "port": 9000 },
    "tags": {
      "http.method": "GET",
      "http.path": "/api",
      "jaxrs.resource.class": "Resource",
      "jaxrs.resource.method": "printDate"
    },
    "shared": true
  }
]
```

## Linking Trace ID from logs

You can link to Zipkin trace from logs in Loki by configuring a derived field with internal link. See [Loki documentation]({{< relref "loki#derived-fields" >}}) for details.
