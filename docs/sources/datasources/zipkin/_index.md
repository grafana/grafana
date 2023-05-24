---
aliases:
  - ../data-sources/zipkin/
  - ../data-sources/zipkin/query-editor/
description: Guide for using Zipkin in Grafana
keywords:
  - grafana
  - zipkin
  - tracing
  - querying
menuTitle: Zipkin
title: Zipkin data source
weight: 1600
---

# Zipkin data source

Grafana ships with built-in support for Zipkin, an open source, distributed tracing system.

For instructions on how to add a data source to Grafana, refer to the [administration documentation]({{< relref "../../administration/data-source-management/" >}}).
Only users with the organization administrator role can add data sources.
Administrators can also [configure the data source via YAML]({{< relref "#provision-the-data-source" >}}) with Grafana's provisioning system.

Once you've added the Zipkin data source, you can [configure it]({{< relref "#configure-the-data-source" >}}) so that your Grafana instance's users can create queries in its [query editor]({{< relref "#query-traces" >}}) when they [build dashboards]({{< relref "../../dashboards/build-dashboards/" >}}) and use [Explore]({{< relref "../../explore/" >}}).

## Configure the data source

**To access the data source configuration page:**

1. Hover the cursor over the **Configuration** (gear) icon.
1. Select **Data Sources**.
1. Select the Zipkin data source.

Set the data source's basic configuration options carefully:

| Name           | Description                                                              |
| -------------- | ------------------------------------------------------------------------ |
| **Name**       | Sets the name you use to refer to the data source in panels and queries. |
| **Default**    | Defines whether this data source is pre-selected for new panels.         |
| **URL**        | Sets the URL of the Zipkin instance, such as `http://localhost:9411`.    |
| **Basic Auth** | Enables basic authentication for the Zipkin data source.                 |
| **User**       | Defines the user name for basic authentication.                          |
| **Password**   | Defines the password for basic authentication.                           |

### Configure trace to logs

{{< figure src="/static/img/docs/explore/traces-to-logs-settings-8-2.png" class="docs-image--no-shadow" caption="Screenshot of the trace to logs settings" >}}

> **Note:** Available in Grafana v7.4 and higher.

The **Trace to logs** setting configures the [trace to logs feature]({{< relref "../../explore/trace-integration" >}}) that is available when you integrate Grafana with Zipkin.

**To configure trace to logs:**

1. Select the target data source.
1. Select which tags to use in the logs query. The tags you configure must be present in the spans attributes or resources for a trace to logs span link to appear.

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

## Query traces

You can query and display traces from Zipkin via [Explore]({{< relref "../../explore/" >}}).

This topic explains configuration and queries specific to the Zipkin data source.
For general documentation on querying data sources in Grafana, see [Query and transform data]({{< relref "../../panels-visualizations/query-transform-data" >}}).

{{< figure src="/static/img/docs/v70/zipkin-query-editor.png" class="docs-image--no-shadow" caption="Screenshot of the Zipkin query editor" >}}

To query by trace ID, enter it.

{{< figure src="/static/img/docs/v70/zipkin-query-editor-open.png" class="docs-image--no-shadow" caption="Screenshot of the Zipkin query editor with trace selector expanded" >}}

To select a particular trace from all traces logged in the time range you have selected in Explore, you can also query by trace selector.
The trace selector has three levels of nesting:

- The service you're interested in.
- Particular operation, part of the selected service
- Specific trace in which the selected operation occurred, represented by the root operation name and trace duration

## View data mapping in the trace UI

You can view Zipkin annotations in the trace view as logs with annotation value displayed under the annotation key.

## Upload a JSON trace file

You can upload a JSON file that contains a single trace and visualize it.
If the file has multiple traces, Grafana visualizes its first trace.

{{< figure src="/static/img/docs/explore/zipkin-upload-json.png" class="docs-image--no-shadow" caption="Screenshot of the Zipkin data source in explore with upload selected" >}}

### Trace JSON example

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

## Link a trace ID from logs

You can link to a Zipkin trace from logs in [Loki](/docs/loki/latest/) or Splunk by configuring a derived field with an internal link.

For details, refer to [Derived fields]({{< relref "../loki/#configure-derived-fields" >}}) section of the [Loki data source]({{< relref "../loki/" >}}) documentation.
