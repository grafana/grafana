---
aliases:
  - ../data-sources/tempo/
  - ../features/datasources/tempo/
description: Guide for using Tempo in Grafana
keywords:
  - grafana
  - tempo
  - guide
  - tracing
menuTitle: Tempo
title: Tempo data source
weight: 1400
---

# Tempo data source

Grafana ships with built-in support for Tempo, a high-volume, minimal-dependency trace storage, open-source tracing solution from Grafana Labs.

For instructions on how to add a data source to Grafana, refer to the [administration documentation]({{< relref "../../administration/data-source-management/" >}}).
Only users with the organization administrator role can add data sources.
Administrators can also [configure the data source via YAML]({{< relref "#provision-the-data-source" >}}) with Grafana's provisioning system.

Once you've added the data source, you can [configure it]({{< relref "#configure-the-data-source" >}}) so that your Grafana instance's users can create queries in its [query editor]({{< relref "./query-editor/" >}}) when they [build dashboards]({{< relref "../../dashboards/build-dashboards/" >}}) and use [Explore]({{< relref "../../explore/" >}}).

You can also [use the Service Graph]({{< relref "#use-the-service-graph" >}}) to view service relationships, [track RED metrics]({{< relref "#open-the-service-graph-view" >}}), [upload a JSON trace file]({{< relref "#upload-a-json-trace-file" >}}), and [link a trace ID from logs]({{< relref "#link-a-trace-id-from-logs" >}}) from a logs data source.

## Configure the data source

**To access the data source configuration page:**

1. Hover the cursor over the **Configuration** (gear) icon.
1. Select **Data Sources**.
1. Select the Tempo data source.

Set the data source's basic configuration options carefully:

| Name           | Description                                                              |
| -------------- | ------------------------------------------------------------------------ |
| **Name**       | Sets the name you use to refer to the data source in panels and queries. |
| **Default**    | Sets the data source that's pre-selected for new panels.                 |
| **URL**        | Sets the URL of the Tempo instance, such as `http://tempo`.              |
| **Basic Auth** | Enables basic authentication to the Tempo data source.                   |
| **User**       | Sets the user name for basic authentication.                             |
| **Password**   | Sets the password for basic authentication.                              |

You can also configure settings specific to the Tempo data source. These options are described in the sections below.

### Trace to logs

![Trace to logs settings](/media/docs/tempo/tempo-trace-to-logs-9-4.png)

> **Note:** Available in Grafana v7.4 and higher.
> If you use Grafana Cloud, open a [support ticket in the Cloud Portal](/profile/org#support) to access this feature.

The **Trace to logs** setting configures the [trace to logs feature]({{< relref "../../explore/trace-integration" >}}) that is available when you integrate Grafana with Tempo.

There are two ways to configure the trace to logs feature:

- Use a simplified configuration with default query, or
- Configure a custom query where you can use a [template language]({{< relref "../../dashboards/variables/variable-syntax">}}) to interpolate variables from the trace or span.

#### Use a simple configuration

1. Select the target data source.
1. Set start and end time shift. As the logs timestamps may not exactly match the timestamps of the spans in trace it may be necessary to search in larger or shifted time range to find the desired logs.
1. Select which tags to use in the logs query. The tags you configure must be present in the spans attributes or resources for a trace to logs span link to appear. You can optionally configure a new name for the tag. This is useful for example if the tag has dots in the name and the target data source does not allow using dots in labels. In that case you can for example remap `http.status` to `http_status`.
1. Optionally switch on the **Filter by trace ID** and/or **Filter by span ID** setting to further filter the logs if your logs consistently contain trace or span IDs.

#### Configure a custom query

1. Select the target data source.
1. Set start and end time shift. As the logs timestamps may not exactly match the timestamps of the spans in the trace it may be necessary to widen or shift the time range to find the desired logs.
1. Optionally select tags to map. These tags can be used in the custom query with `${__tags}` variable. This variable will interpolate the mapped tags as list in an appropriate syntax for the data source and will only include the tags that were present in the span omitting those that weren't present. You can optionally configure a new name for the tag. This is useful in cases where the tag has dots in the name and the target data source does not allow using dots in labels. For example, you can remap `http.status` to `http_status` in such a case. If you don't map any tags here, you can still use any tag in the query like this `method="${__span.tags.method}"`.
1. Skip **Filter by trace ID** and **Filter by span ID** settings as these cannot be used with a custom query.
1. Switch on **Use custom query**.
1. Specify a custom query to be used to query the logs. You can use various variables to make that query relevant for current span. The link will only be shown only if all the variables are interpolated with non-empty values to prevent creating an invalid query.

#### Variables that can be used in a custom query

To use a variable you need to wrap it in `${}`. For example `${__span.name}`.

| Variable name          | Description                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **\_\_tags**           | This variable uses the tag mapping from the UI to create a label matcher string in the specific data source syntax. The variable only uses tags that are present in the span. The link is still created even if only one of those tags is present in the span. You can use this if all tags are not required for the query to be useful. |
| **\_\_span.spanId**    | The ID of the span.                                                                                                                                                                                                                                                                                                                      |
| **\_\_span.traceId**   | The ID of the trace.                                                                                                                                                                                                                                                                                                                     |
| **\_\_span.duration**  | The duration of the span.                                                                                                                                                                                                                                                                                                                |
| **\_\_span.name**      | Name of the span.                                                                                                                                                                                                                                                                                                                        |
| **\_\_span.tags**      | Namespace for the tags in the span. To access a specific tag named `version`, you would use `${__span.tags.version}`. In case the tag contains dot, you have to access it as `${__span.tags["http.status"]}`.                                                                                                                            |
| **\_\_trace.traceId**  | The ID of the trace.                                                                                                                                                                                                                                                                                                                     |
| **\_\_trace.duration** | The duration of the trace.                                                                                                                                                                                                                                                                                                               |
| **\_\_trace.name**     | The name of the trace.                                                                                                                                                                                                                                                                                                                   |

The following table describes the ways in which you can configure your trace to logs settings:

| Setting name              | Description                                                                                                                                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data source**           | Defines the target data source. You can select only Loki or Splunk \[logs\] data sources.                                                                                                                                                                                    |
| **Span start time shift** | Shifts the start time for the logs query, based on the span's start time. You can use time units, such as `5s`, `1m`, `3h`. To extend the time to the past, use a negative value. Default: `0`.                                                                              |
| **Span end time shift**   | Shifts the end time for the logs query, based on the span's end time. You can use time units. Default: `0`.                                                                                                                                                                  |
| **Tags**                  | Defines the the tags to use in the logs query. Default is `cluster`, `hostname`, `namespace`, `pod`. You can change the tag name for example to remove dots from the name if they are not allowed in the target data source. For example map `http.status` to `http_status`. |
| **Filter by trace ID**    | Toggles whether to append the trace ID to the logs query.                                                                                                                                                                                                                    |
| **Filter by span ID**     | Toggles whether to append the span ID to the logs query.                                                                                                                                                                                                                     |
| **Use custom query**      | Toggles use of custom query with interpolation.                                                                                                                                                                                                                              |
| **Query**                 | Input to write custom query. Use variable interpolation to customize it with variables from span.                                                                                                                                                                            |

### Trace to metrics

> **Note:** This feature is behind the `traceToMetrics` [feature toggle]({{< relref "../../setup-grafana/configure-grafana#feature_toggles" >}}).
> If you use Grafana Cloud, open a [support ticket in the Cloud Portal](/profile/org#support) to access this feature.

The **Trace to metrics** setting configures the [trace to metrics feature](/blog/2022/08/18/new-in-grafana-9.1-trace-to-metrics-allows-users-to-navigate-from-a-trace-span-to-a-selected-data-source/) available when integrating Grafana with Tempo.

**To configure trace to metrics:**

1. Select the target data source.
1. Create any desired linked queries.

| Setting name    | Description                                                                                                                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data source** | Defines the target data source.                                                                                                                                                                                                                                 |
| **Tags**        | Defines the tags used in linked queries. The key sets the span attribute name, and the optional value sets the corresponding metric label name. For example, you can map `k8s.pod` to `pod`. To interpolate these tags into queries, use the `$__tags` keyword. |

Each linked query consists of:

- **Link Label:** _(Optional)_ Descriptive label for the linked query.
- **Query:** The query ran when navigating from a trace to the metrics data source.
  Interpolate tags using the `$__tags` keyword.
  For example, when you configure the query `requests_total{$__tags}`with the tags `k8s.pod=pod` and `cluster`, the result looks like `requests_total{pod="nginx-554b9", cluster="us-east-1"}`.

### Service Graph

The **Service Graph** section configures the [Service Graph](/docs/tempo/latest/grafana-agent/service-graphs/) feature.

Configure the **Data source** setting to define in which Prometheus instance the Service Graph data is stored.

To use the Service Graph, refer to the [Service Graph documentation]({{< relref "#use-the-service-graph" >}}).

### Node Graph

The **Node Graph** setting enables the [node graph visualization]({{< relref "../../panels-visualizations/visualizations/node-graph/" >}}), which is disabled by default.

Once enabled, Grafana displays the node graph after loading the trace view.

### Tempo search

The **Search** section configures [Tempo search](/docs/tempo/latest/configuration/#search).

You can configure the **Hide search** setting to hide the search query option in **Explore** if search is not configured in the Tempo instance.

### Loki search

The **Loki search** section configures the Loki search query type.

Configure the **Data source** setting to define which Loki instance you want to use to search traces.
You must configure [derived fields]({{< relref "../loki#configure-derived-fields" >}}) in the Loki instance.

### Span bar label

The **Span bar label** section helps you display additional information in the span bar row.

You can choose one of three options:

| Name         | Description                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **None**     | Adds nothing to the span bar row.                                                                                                |
| **Duration** | _(Default)_ Displays the span duration on the span bar row.                                                                      |
| **Tag**      | Displays the span tag on the span bar row. You must also specify which tag key to use to get the tag value, such as `span.kind`. |

### Provision the data source

You can define and configure the Tempo data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning, and for available configuration options, refer to [Provisioning Grafana]({{< relref "../../administration/provisioning/#data-sources" >}}).

#### Provisioning examples

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
            query: 'sum(rate(traces_spanmetrics_latency_bucket{$__tags}[5m]))'
      serviceMap:
        datasourceUid: 'prometheus'
      search:
        hide: false
      nodeGraph:
        enabled: true
      lokiSearch:
        datasourceUid: 'loki'
```

## Query the data source

The Tempo data source's query editor helps you query and display traces from Tempo in [Explore]({{< relref "../../explore" >}}).

For details, refer to the [query editor documentation]({{< relref "./query-editor" >}}).

## Upload a JSON trace file

You can upload a JSON file that contains a single trace and visualize it.
If the file has multiple traces, Grafana visualizes its first trace.

**To download a trace or Service Graph through the inspector:**

1. Open the inspector.
1. Navigate to the **Data** tab.
1. Click **Download traces** or **Download Service Graph**.

### Trace JSON example

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

## Use the Service Graph

The Service Graph is a visual representation of the relationships between services.
Each node on the graph represents a service such as an API or database.

You use the Service Graph to detect performance issues; track increases in error, fault, or throttle rates in services; and investigate root causes by viewing corresponding traces.

{{< figure src="/static/img/docs/node-graph/node-graph-8-0.png" class="docs-image--no-shadow" max-width="500px" caption="Screenshot of a Node Graph" >}}

**To display the Service Graph:**

1. [Configure Grafana Agent](/docs/tempo/latest/grafana-agent/service-graphs/#quickstart) or [Tempo or GET](/docs/tempo/latest/metrics-generator/service_graphs/#tempo) to generate Service Graph data.
1. Link a Prometheus data source in the Tempo data source's [Service Graph](#configure-service-graph) settings.
1. Navigate to [Explore]({{< relref "../../explore/" >}}).
1. Select the Tempo data source.
1. Select the **Service Graph** query type.
1. Run the query.
1. _(Optional)_ Filter by service name.

For details, refer to [Node Graph panel]({{< relref "../../panels-visualizations/visualizations/node-graph/" >}}).

Each circle in the graph represents a service.
To open a context menu with additional links for quick navigation to other relevant information, click a service.

Numbers inside the circles indicate the average time per request and requests per second.

Each circle's color represents the percentage of requests in each state:

| Color      | State               |
| ---------- | ------------------- |
| **Green**  | Success             |
| **Red**    | Fault               |
| **Yellow** | Errors              |
| **Purple** | Throttled responses |

## Open the Service Graph view

Service graph view displays a table of request rate, error rate, and duration metrics (RED) calculated from your incoming spans. It also includes a node graph view built from your spans.

{{< figure src="/static/img/docs/tempo/apm-table.png" class="docs-image--no-shadow" max-width="500px" caption="Screenshot of the Service Graph view table" >}}

For details, refer to the [Service Graph view documentation](/docs/tempo/latest/metrics-generator/service-graph-view/).

To open the Service Graph view:

1. Link a Prometheus data source in the Tempo data source settings.
1. Navigate to [Explore]({{< relref "../../explore/" >}}).
1. Select the Tempo data source.
1. Select the **Service Graph** query type.
1. Run the query.
1. _(Optional)_ Filter your results.

> **Note:** Grafana uses the `traces_spanmetrics_calls_total` metric to display the name, rate, and error rate columns, and `traces_spanmetrics_latency_bucket` to display the duration column.
> These metrics must exist in your Prometheus data source.

To open a query in Prometheus with the span name of that row automatically set in the query, click a row in the **rate**, **error rate**, or **duration** columns.

To open a query in Tempo with the span name of that row automatically set in the query, click a row in the **links** column.

## Link a trace ID from logs

You can link to Tempo trace from logs in [Loki](/docs/loki/latest) or Elasticsearch by configuring an internal link.

To configure this feature, see the [Derived fields]({{< relref "../loki#configure-derived-fields" >}}) section of the [Loki data source docs]({{< relref "../loki/" >}}), or the [Data links]({{< relref "../elasticsearch#data-links" >}}) section of the [Elasticsearch data source docs]({{< relref "../elasticsearch" >}}).
