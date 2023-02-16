---
aliases:
  - ../data-sources/jaeger/
  - ../features/datasources/jaeger/
description: Guide for using Jaeger in Grafana
keywords:
  - grafana
  - jaeger
  - guide
  - tracing
menuTitle: Jaeger
title: Jaeger data source
weight: 800
---

# Jaeger data source

Grafana ships with built-in support for Jaeger, which provides open source, end-to-end distributed tracing.
This topic explains configuration and queries specific to the Jaeger data source.

For instructions on how to add a data source to Grafana, refer to the [administration documentation]({{< relref "../../administration/data-source-management" >}}).
Only users with the organization administrator role can add data sources.
Administrators can also [configure the data source via YAML]({{< relref "#provision-the-data-source" >}}) with Grafana's provisioning system.

You can also [upload a JSON trace file]({{< relref "#upload-a-json-trace-file" >}}), and [link a trace ID from logs]({{< relref "#link-a-trace-id-from-logs" >}}) in Loki.

## Configure the data source

**To access the data source configuration page:**

1. Hover the cursor over the **Configuration** (gear) icon.
1. Select **Data Sources**.
1. Select the Jaeger data source.

Set the data source's basic configuration options carefully:

| Name           | Description                                                              |
| -------------- | ------------------------------------------------------------------------ |
| **Name**       | Sets the name you use to refer to the data source in panels and queries. |
| **Default**    | Defines whether this data source is pre-selected for new panels.         |
| **URL**        | Sets the URL of the Jaeger instance, such as `http://localhost:16686`.   |
| **Basic Auth** | Enables basic authentication for the Jaeger data source.                 |
| **User**       | Defines the user name for basic authentication.                          |
| **Password**   | Defines the password for basic authentication.                           |

You can also configure settings specific to the Jaeger data source:

### Configure trace to logs

{{< figure src="/static/img/docs/explore/traces-to-logs-settings-8-2.png" class="docs-image--no-shadow" caption="Screenshot of the trace to logs settings" >}}

> **Note:** Available in Grafana v7.4 and higher.

The **Trace to logs** setting configures the [trace to logs feature]({{< relref "../../explore/trace-integration" >}}) that is available when you integrate Grafana with Jaeger.

**To configure trace to logs:**

1. Select the target data source.
2. Select which tags to use in the logs query. The tags you configure must be present in the spans attributes or resources for a trace to logs span link to appear.
   - **Single tag**
     - Configuring `job` as a tag and clicking on a span link will take you to your configured logs datasource with the query `{job='value from clicked span'}`.
   - **Multiple tags**
     - If multiple tags are used they will be concatenated so the logs query would look like `{job='value from clicked span', service='value from clicked span'}`.
   - **Mapped tags**
     - For a mapped tag `service.name` with value `service`, clicking on a span link will take you to your configured logs datasource with the query `{service='value from clicked span'}` instead of `{service.name='value from clicked span'}`.
     - This is useful for instances where your tracing datasource tags and your logs datasource tags don't match one-to-one.

The following table describes the ways in which you can configure your trace to logs settings:

| Name                      | Description                                                                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data source**           | Sets the target data source.                                                                                                                                                       |
| **Tags**                  | Defines the tags to use in the logs query. Default is `'cluster', 'hostname', 'namespace', 'pod'`.                                                                                 |
| **Map tag names**         | Enables configuring how Jaeger tag names map to logs label names. For example, map `service.name` to `service`.                                                                    |
| **Span start time shift** | Shifts the start time for the logs query based on the span start time. To extend to the past, use a negative value. Use time interval units like `5s`, `1m`, `3h`. Default is `0`. |
| **Span end time shift**   | Shifts the end time for the logs query based on the span end time. Use time interval units. Default is `0`.                                                                        |
| **Filter by Trace ID**    | Toggles whether to append the trace ID to the logs query.                                                                                                                          |
| **Filter by Span ID**     | Toggles whether to append the span ID to the logs query.                                                                                                                           |

### Configure trace to metrics

> **Note:** This feature is behind the `traceToMetrics` [feature toggle]({{< relref "../../setup-grafana/configure-grafana#feature_toggles" >}}).

The **Trace to metrics** section configures the [trace to metrics feature](/blog/2022/08/18/new-in-grafana-9.1-trace-to-metrics-allows-users-to-navigate-from-a-trace-span-to-a-selected-data-source/).

Use the settings to select the target Prometheus data source, and create any desired linked queries.

| Setting name    | Description                                                                                                                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data source** | Defines the target data source.                                                                                                                                                                                                                                 |
| **Tags**        | Defines the tags used in linked queries. The key sets the span attribute name, and the optional value sets the corresponding metric label name. For example, you can map `k8s.pod` to `pod`. To interpolate these tags into queries, use the `$__tags` keyword. |

Each linked query consists of:

- **Link Label:** _(Optional)_ Descriptive label for the linked query.
- **Query:** The query ran when navigating from a trace to the metrics data source.
  Interpolate tags using the `$__tags` keyword.
  For example, when you configure the query `requests_total{$__tags}`with the tags `k8s.pod=pod` and `cluster`, the result looks like `requests_total{pod="nginx-554b9", cluster="us-east-1"}`.

### Enable Node Graph

The **Node Graph** setting enables the [Node Graph visualization]({{< relref "../../panels-visualizations/visualizations/node-graph/" >}}), which is disabled by default.

Once enabled, Grafana displays the Node Graph after loading the trace view.

### Configure the span bar label

The **Span bar label** section helps you display additional information in the span bar row.

You can choose one of three options:

| Name         | Description                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **None**     | Adds nothing to the span bar row.                                                                                                |
| **Duration** | _(Default)_ Displays the span duration on the span bar row.                                                                      |
| **Tag**      | Displays the span tag on the span bar row. You must also specify which tag key to use to get the tag value, such as `span.kind`. |

### Provision the data source

You can define and configure the data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning, and for available configuration options, refer to [Provisioning Grafana]({{< relref "../../administration/provisioning#data-sources" >}}).

#### Provisioning examples

**Using basic auth and the trace-to-logs field:**

```yaml
apiVersion: 1

datasources:
  - name: Jaeger
    type: jaeger
    uid: jaeger-spectra
    access: proxy
    url: http://localhost:16686/
    basicAuth: true
    basicAuthUser: my_user
    editable: true
    isDefault: false
    jsonData:
      tracesToLogs:
        # Field with internal link pointing to a logs data source in Grafana.
        # datasourceUid value must match the datasourceUid value of the logs data source.
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
    secureJsonData:
      basicAuthPassword: my_password
```

## Query traces

You can query and display traces from Jaeger via [Explore]({{< relref "../../explore" >}}).

{{< figure src="/static/img/docs/explore/jaeger-search-form.png" class="docs-image--no-shadow" caption="Screenshot of the Jaeger query editor" >}}

You can query by trace ID, or use the search form to find traces.

### Query by trace ID

{{< figure src="/static/img/docs/explore/jaeger-trace-id.png" class="docs-image--no-shadow" caption="Screenshot of the Jaeger query editor with trace ID selected" >}}

**To query by trace ID:**

1. Select **TraceID** from the **Query** type selector.
1. Insert the ID into the text input.

### Query by search

**To search for traces:**

1. Select **Search** from the **Query** type selector.
1. Fill out the search form:

| Name             | Description                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Service**      | Returns a list of services.                                                                                                       |
| **Operation**    | Populated when you select a service with related operations. Select `All` to query all operations.                                |
| **Tags**         | Sets tags with values in the [logfmt](https://brandur.org/logfmt) format, such as `error=true db.statement="select * from User"`. |
| **Min Duration** | Filters all traces with a duration higher than the set value. Valid values are `1.2s, 100ms, 500us`.                              |
| **Max Duration** | Filters all traces with a duration lower than the set value. Valid values are `1.2s, 100ms, 500us`.                               |
| **Limit**        | Limits the number of traces returned.                                                                                             |

## Upload a JSON trace file

You can upload a JSON file that contains a single trace and visualize it.
If the file has multiple traces, Grafana visualizes its first trace.

{{< figure src="/static/img/docs/explore/jaeger-upload-json.png" class="docs-image--no-shadow" caption="Screenshot of the Jaeger data source in explore with upload selected" >}}

### Trace JSON example

```json
{
  "data": [
    {
      "traceID": "2ee9739529395e31",
      "spans": [
        {
          "traceID": "2ee9739529395e31",
          "spanID": "2ee9739529395e31",
          "flags": 1,
          "operationName": "CAS",
          "references": [],
          "startTime": 1616095319593196,
          "duration": 1004,
          "tags": [
            {
              "key": "sampler.type",
              "type": "string",
              "value": "const"
            }
          ],
          "logs": [],
          "processID": "p1",
          "warnings": null
        }
      ],
      "processes": {
        "p1": {
          "serviceName": "loki-all",
          "tags": [
            {
              "key": "jaeger.version",
              "type": "string",
              "value": "Go-2.25.0"
            }
          ]
        }
      },
      "warnings": null
    }
  ],
  "total": 0,
  "limit": 0,
  "offset": 0,
  "errors": null
}
```

## Link a trace ID from logs

You can link to a Jaeger trace from logs in [Loki](/docs/loki/latest/) by configuring a derived field with an internal link.

For details, refer to [Derived fields]({{< relref "../loki/#configure-derived-fields" >}}) section of the [Loki data source]({{< relref "../loki/" >}}) documentation.
