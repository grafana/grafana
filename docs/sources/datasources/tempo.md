---
aliases:
  - /docs/grafana/latest/datasources/tempo/
  - /docs/grafana/latest/features/datasources/tempo/
description: High volume, minimal dependency trace storage. OSS tracing solution from
  Grafana Labs.
keywords:
  - grafana
  - tempo
  - guide
  - tracing
title: Tempo
weight: 1400
---

# Tempo data source

Grafana ships with built-in support for Tempo, a high volume, minimal dependency trace storage, OSS tracing solution from Grafana Labs. Add it as a data source, and you are ready to query your traces in [Explore]({{< relref "../explore" >}}).

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
> Grafana Cloud users can access this feature by [opening a support ticket in the Cloud Portal](https://grafana.com/profile/org#support).

This is a configuration for the [trace to logs feature]({{< relref "../explore/trace-integration/" >}}). Select target data source (at this moment limited to Loki or Splunk \[logs\] data sources) and select which tags will be used in the logs query.

- **Data source -** Target data source.
- **Tags -** The tags that will be used in the logs query. Default is `'cluster', 'hostname', 'namespace', 'pod'`.
- **Map tag names -** When enabled, allows configuring how Tempo tag names map to logs label names. For example, map `service.name` to `service`.
- **Span start time shift -** A shift in the start time for the logs query based on the start time for the span. To extend the time to the past, use a negative value. You can use time units, for example, 5s, 1m, 3h. The default is 0.
- **Span end time shift -** Shift in the end time for the logs query based on the span end time. Time units can be used here, for example, 5s, 1m, 3h. The default is 0.
- **Filter by Trace ID -** Toggle to append the trace ID to the logs query.
- **Filter by Span ID -** Toggle to append the span ID to the logs query.

{{< figure src="/static/img/docs/explore/traces-to-logs-settings-8-2.png" class="docs-image--no-shadow" caption="Screenshot of the trace to logs settings" >}}

### Trace to metrics

> **Note:** This feature is behind the `traceToMetrics` feature toggle.
> Grafana Cloud users can access this feature by [opening a support ticket in the Cloud Portal](https://grafana.com/profile/org#support).

To configure trace to metrics, select the target Prometheus data source and create any desired linked queries.

-- **Data source -** Target data source.
-- **Tags -** You can use tags in the linked queries. The key is the span attribute name. The optional value is the corresponding metric label name (for example, map `k8s.pod` to `pod`). You may interpolate these tags into your queries using the `$__tags` keyword.

Each linked query consists of:

-- **Link Label -** (Optional) Descriptive label for the linked query.
-- **Query -** Query that runs when navigating from a trace to the metrics data source. Interpolate tags using the `$__tags` keyword. For example, when you configure the query `requests_total{$__tags}`with the tags `k8s.pod=pod` and `cluster`, it results in `requests_total{pod="nginx-554b9", cluster="us-east-1"}`.

### Service Graph

This is a configuration for the Service Graph feature.

-- **Data source -** Prometheus instance where the Service Graph data is stored.

### Search

This is a configuration for Tempo search.

-- **Hide search -** Optionally, hide the search query option in Explore in cases where search is not configured in the Tempo instance.

### Node Graph

This is a configuration for the beta Node Graph visualization. The Node Graph is shown after the trace view is loaded and is disabled by default.

-- **Enable Node Graph -** Enables the Node Graph visualization.

### Loki search

This is a configuration for the Loki search query type.

-- **Data source -** The Loki instance in which you want to search traces. You must configure derived fields in the Loki instance.

### Span bar label

You can configure the span bar label. The span bar label allows you add additional information to the span bar row.

Select one of the following four options. The default selection is Duration.

- **None -** Do not show any additional information on the span bar row.
- **Duration -** Show the span duration on the span bar row.
- **Tag -** Show the span tag on the span bar row. Note: You will also need to specify the tag key to use to get the tag value. For example, `span.kind`.

## Query traces

You can query and display traces from Tempo via [Explore]({{< relref "../explore/" >}}).

### Tempo search

Tempo search is an experimental feature behind a feature toggle. Use this to search for traces by service name, span name, duration range, or process-level attributes that are included in your application’s instrumentation, such as HTTP status code and customer ID.

{{< figure src="/static/img/docs/explore/tempo-search.png" class="docs-image--no-shadow" max-width="750px" caption="Screenshot of the Tempo search feature with a trace rendered in the right panel" >}}

#### Search recent traces

Tempo allows you to search recent traces held in the ingesters. By default, ingesters store the last 15 minutes of tracing data. You must configure your Tempo data source to use this feature. Refer to the [Tempo documentation](https://grafana.com/docs/tempo/latest/getting-started/tempo-in-grafana/#search-of-recent-traces).

#### Search backend datastore

Tempo includes the ability to search the entire backend datastore. You must configure your Tempo data source to use this feature. Refer to the [Tempo documentation](https://grafana.com/docs/tempo/latest/getting-started/tempo-in-grafana/#search-of-the-backend-datastore).

### Loki search

To find traces to visualize, use the [Loki query editor]({{< relref "loki/#loki-query-editor" >}}). To get search results, you must have [derived fields]({{< relref "loki/#derived-fields" >}}) configured, which point to this data source.

{{< figure src="/static/img/docs/tempo/query-editor-search.png" class="docs-image--no-shadow" max-width="750px" caption="Screenshot of the Tempo query editor showing the search tab" >}}

### Trace ID search

To query a particular trace, select the **TraceID** query type, and then put the ID into the Trace ID field.

{{< figure src="/static/img/docs/tempo/query-editor-traceid.png" class="docs-image--no-shadow" max-width="750px" caption="Screenshot of the Tempo TraceID query type" >}}

## Upload JSON trace file

You can upload a JSON file that contains a single trace or service graph to visualize it. If the file has multiple traces, the first trace is used for visualization.

You can download a trace or service graph through the inspector. Open the inspector, navigate to the 'Data' tab, and click 'Download traces' or 'Download service graph'.

Here is an example JSON:

```json
{
  "batches": [
    {
      "resource": {
        "attributes": [
          { "key": "service.name", "value": { "stringValue": "db" } },
          { "key": "job", "value": { "stringValue": "tns/db" } },
          { "key": "opencensus.exporterversion", "value": { "stringValue": "Jaeger-Go-2.22.1" } },
          { "key": "host.name", "value": { "stringValue": "63d16772b4a2" } },
          { "key": "ip", "value": { "stringValue": "0.0.0.0" } },
          { "key": "client-uuid", "value": { "stringValue": "39fb01637a579639" } }
        ]
      },
      "instrumentationLibrarySpans": [
        {
          "instrumentationLibrary": {},
          "spans": [
            {
              "traceId": "AAAAAAAAAABguiq7RPE+rg==",
              "spanId": "cmteMBAvwNA=",
              "parentSpanId": "OY8PIaPbma4=",
              "name": "HTTP GET - root",
              "kind": "SPAN_KIND_SERVER",
              "startTimeUnixNano": "1627471657255809000",
              "endTimeUnixNano": "1627471657256268000",
              "attributes": [
                { "key": "http.status_code", "value": { "intValue": "200" } },
                { "key": "http.method", "value": { "stringValue": "GET" } },
                { "key": "http.url", "value": { "stringValue": "/" } },
                { "key": "component", "value": { "stringValue": "net/http" } }
              ],
              "status": {}
            }
          ]
        }
      ]
    }
  ]
}
```

## Service graph

A service graph is a visual representation of the relationships between services. Each node on the graph represents a service such as an API or database. With this graph, customers can easily detect performance issues, increases in error, fault, or throttle rates in any of their services, and dive deep into corresponding traces and root causes.

![Node graph panel](/static/img/docs/node-graph/node-graph-8-0.png 'Node graph')

To display the service graph:

- [Configure Grafana Agent](https://grafana.com/docs/tempo/latest/grafana-agent/service-graphs/#quickstart), or [Tempo or GET](https://grafana.com/docs/tempo/latest/metrics-generator/service_graphs/#tempo) to generate service graph data
- Link a Prometheus data source in the Tempo data source settings.
- Navigate to [Explore]({{< relref "../explore/" >}}).
- Select the Tempo data source.
- Select the **Service Graph** query type and run the query.
- (Optional): Filter by service name.

You can pan and zoom the view with buttons or you mouse. For details about the visualization, refer to [Node graph panel](https://grafana.com/docs/grafana/latest/panels/visualizations/node-graph/).

Each service in the graph is represented as a circle. Numbers on the inside shows average time per request and request per second.

The color of each circle represents the percentage of requests in each of the following states:

- green = success
- red = fault
- yellow = errors
- purple = throttled responses

Click on the service to see a context menu with additional links for quick navigation to other relevant information.

## APM table

The Application Performance Management (APM) table lets you view several APM metrics out of the box.
The APM table is part of the APM dashboard.
For more information, refer to the [APM dashboard documentation](https://grafana.com/docs/tempo/latest/metrics-generator/app-performance-mgmt/).

To display the APM table:

1. Activate the `tempoApmTable` feature flag in your `grafana.ini` file.
1. Link a Prometheus data source in the Tempo data source settings.
1. Navigate to [Explore]({{< relref "../explore/_index.md" >}}).
1. Select the Tempo data source.
1. Select the **Service Graph** query type and run the query.
1. (Optional): Filter your results.

> **Note:** The metric `traces_spanmetrics_calls_total` is used to display the name, rate, and error rate columns and `traces_spanmetrics_latency_bucket` is used to display the duration column. These metrics need to exist in your Prometheus data source.

Click a row in the rate, error rate, or duration columns to open a query in Prometheus with the span name of that row automatically set in the query.
Click a row in the links column to open a query in Tempo with the span name of that row automatically set in the query.

{{< figure src="/static/img/docs/tempo/apm-table.png" class="docs-image--no-shadow" max-width="500px" caption="Screenshot of the Tempo APM table" >}}

## Linking Trace ID from logs

You can link to Tempo trace from logs in Loki or Elastic by configuring an internal link. See the [Derived fields]({{< relref "loki/#derived-fields" >}}) section in the [Loki data source]({{< relref "loki/" >}}) or [Data links]({{< relref "elasticsearch/#data-links" >}}) section in the [Elastic data source]({{< relref "elasticsearch/" >}}) for configuration instructions.

## Provision the Tempo data source

You can modify the Grafana configuration files to provision the Tempo data source. Read more about how it works and all the settings you can set for data sources on the [provisioning]({{< relref "../administration/provisioning/#datasources" >}}) topic.

Here is an example config:

```yaml
apiVersion: 1

datasources:
  - name: Tempo
    type: tempo
    # Access mode - proxy (server in the UI) or direct (browser in the UI).
    access: proxy
    url: http://localhost:3200
    jsonData:
      httpMethod: GET
      tracesToLogs:
        datasourceUid: 'loki'
        tags: ['job', 'instance', 'pod', 'namespace']
        mappedTags: [{ key: 'service.name', value: 'service' }]
        mapTagNamesEnabled: false
        spanStartTimeShift: '1h'
        spanEndTimeShift: '1h'
        filterByTraceID: false
        filterBySpanID: false
      tracesToMetrics:
        datasourceUid: 'prom'
        tags: [{ key: 'service.name', value: 'service' }, { key: 'job' }]
        queries:
          - name: 'Sample query'
            query: 'sum(rate(tempo_spanmetrics_latency_bucket{$__tags}[5m]))'
      serviceMap:
        datasourceUid: 'prometheus'
      search:
        hide: false
      nodeGraph:
        enabled: true
      lokiSearch:
        datasourceUid: 'loki'
```
