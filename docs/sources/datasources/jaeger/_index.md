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

Grafana ships with built-in support for Jaeger, which provides open source, end-to-end distributed tracing. This topic explains configuration and queries specific to the Jaeger data source.

For instructions on how to add a data source to Grafana, refer to the [administration documentation]({{< relref "../../administration/data-source-management" >}}).
Only users with the organization administrator role can add data sources.
Administrators can also [configure the data source via YAML]({{< relref "#provision-the-data-source" >}}) with Grafana's provisioning system.

Once you've added the data source, you can [configure it]({{< relref "#configure-the-data-source" >}}) so your Grafana instance's users can create queries in the [query editor]({{< relref "#query-the-data-source" >}}) when the users [build dashboards]({{< relref "../../dashboards/build-dashboards/" >}}) and use [Explore]({{< relref "../../explore/" >}}).

You can also [upload a JSON trace file]({{< relref "#upload-a-json-trace-file" >}}), [link to a trace ID from logs]({{< relref "#link-to-a-trace-id-from-logs" >}}), and [link to a trace ID from metrics]({{< relref "#link-to-a-trace-id-from-metrics" >}}).

## Configure the data source

To configure basic settings for the data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Under Your connections, click **Data sources**.
1. Enter `Jaeger` in the search bar.
1. Select **Jaeger**.

   The **Settings** tab of the data source is displayed.

1. Set the data source's basic configuration options:

   | Name           | Description                                                              |
   | -------------- | ------------------------------------------------------------------------ |
   | **Name**       | Sets the name you use to refer to the data source in panels and queries. |
   | **Default**    | Defines whether this data source is pre-selected for new panels.         |
   | **URL**        | Sets the URL of the Jaeger instance, such as `http://localhost:16686`.   |
   | **Basic Auth** | Enables basic authentication for the Jaeger data source.                 |
   | **User**       | Defines the user name for basic authentication.                          |
   | **Password**   | Defines the password for basic authentication.                           |

You can also configure settings specific to the Jaeger data source. These options are described in the sections below.

### Trace to logs

![Trace to logs settings](/media/docs/tempo/tempo-trace-to-logs-9-4.png)

> **Note:** Available in Grafana v7.4 and higher.
> If you use Grafana Cloud, open a [support ticket in the Cloud Portal](/profile/org#support) to access this feature.

The **Trace to logs** setting configures the [trace to logs feature]({{< relref "../../explore/trace-integration" >}}) that is available when you integrate Grafana with Jaeger.

There are two ways to configure the trace to logs feature:

- Use a simplified configuration with default query, or
- Configure a custom query where you can use a [template language]({{< relref "../../dashboards/variables/variable-syntax">}}) to interpolate variables from the trace or span.

#### Use a simple configuration

1. Select the target data source.
1. Set start and end time shift. Since the logs timestamps may not exactly match the timestamps of the spans in trace, it may be necessary to search in larger or shifted time range to find the desired logs.
1. Select which tags to use in the logs query. The tags you configure must be present in the spans attributes or resources for a trace to logs span link to appear. You can optionally configure a new name for the tag. This is useful if the tag has dots in the name and the target data source does not allow dots in labels. In that case, you can, for example, remap `http.status` to `http_status`.
1. Optionally, switch on the **Filter by trace ID** and/or **Filter by span ID** setting to further filter the logs if your logs consistently contain trace or span IDs.

#### Configure a custom query

1. Select the target data source.
1. Set start and end time shift. Since the logs timestamps may not exactly match the timestamps of the spans in the trace, you may need to widen or shift the time range to find the desired logs.
1. Optionally, select tags to map. These tags can be used in the custom query with `${__tags}` variable. This variable will interpolate the mapped tags as a list in an appropriate syntax for the data source and will only include the tags that were present in the span omitting those that weren't present. You can optionally configure a new name for the tag. This is useful in cases where the tag has dots in the name and the target data source does not allow dots in labels. For example, you can remap `http.status` to `http_status`. If you don't map any tags here, you can still use any tag in the query like this `method="${__span.tags.method}"`.
1. Skip **Filter by trace ID** and **Filter by span ID** settings as these cannot be used with a custom query.
1. Switch on **Use custom query**.
1. Specify a custom query to be used to query the logs. You can use various variables to make that query relevant for current span. The link is present only if all the variables are interpolated with non-empty values to prevent creating an invalid query.

#### Variables that can be used in a custom query

To use a variable you need to wrap it in `${}`. For example: `${__span.name}`.

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

| Setting name              | Description                                                                                                                                                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data source**           | Defines the target data source. You can select only Loki or Splunk \[logs\] data sources.                                                                                                                                                                               |
| **Span start time shift** | Shifts the start time for the logs query, based on the span's start time. You can use time units, such as `5s`, `1m`, `3h`. To extend the time to the past, use a negative value. Default: `0`.                                                                         |
| **Span end time shift**   | Shifts the end time for the logs query, based on the span's end time. You can use time units. Default: `0`.                                                                                                                                                             |
| **Tags**                  | Defines the tags to use in the logs query. Default: `cluster`, `hostname`, `namespace`, `pod`. You can change the tag name for example to remove dots from the name if they are not allowed in the target data source. For example, map `http.status` to `http_status`. |
| **Filter by trace ID**    | Toggles whether to append the trace ID to the logs query.                                                                                                                                                                                                               |
| **Filter by span ID**     | Toggles whether to append the span ID to the logs query.                                                                                                                                                                                                                |
| **Use custom query**      | Toggles use of custom query with interpolation.                                                                                                                                                                                                                         |
| **Query**                 | Input to write custom query. Use variable interpolation to customize it with variables from span.                                                                                                                                                                       |

### Trace to metrics

> **Note:** This feature is behind the `traceToMetrics` [feature toggle]({{< relref "../../setup-grafana/configure-grafana#feature_toggles" >}}).
> If you use Grafana Cloud, open a [support ticket in the Cloud Portal](/profile/org#support) to access this feature.

The **Trace to metrics** setting configures the [trace to metrics feature](/blog/2022/08/18/new-in-grafana-9.1-trace-to-metrics-allows-users-to-navigate-from-a-trace-span-to-a-selected-data-source/) available when integrating Grafana with Jaeger.

To configure trace to metrics:

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

### Node Graph

The **Node Graph** setting enables the [Node Graph visualization]({{< relref "../../panels-visualizations/visualizations/node-graph/" >}}), which is disabled by default.

Once enabled, Grafana displays the Node Graph above the trace view.

### Span bar

The **Span bar** setting helps you display additional information in the span bar row.

You can choose one of three options:

| Name         | Description                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **None**     | Adds nothing to the span bar row.                                                                                                |
| **Duration** | _(Default)_ Displays the span duration on the span bar row.                                                                      |
| **Tag**      | Displays the span tag on the span bar row. You must also specify which tag key to use to get the tag value, such as `span.kind`. |

### Provision the data source

You can define and configure the data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning and available configuration options, refer to [Provisioning Grafana]({{< relref "../../administration/provisioning#data-sources" >}}).

#### Provisioning example

```yaml
apiVersion: 1

datasources:
  - name: Jaeger
    type: jaeger
    uid: EbPG8fYoz
    url: http://localhost:16686
    access: proxy
    basicAuth: true
    basicAuthUser: my_user
    readOnly: false
    isDefault: false
    jsonData:
      tracesToLogsV2:
        # Field with an internal link pointing to a logs data source in Grafana.
        # datasourceUid value must match the uid value of the logs data source.
        datasourceUid: 'loki'
        spanStartTimeShift: '1h'
        spanEndTimeShift: '-1h'
        tags: ['job', 'instance', 'pod', 'namespace']
        filterByTraceID: false
        filterBySpanID: false
        customQuery: true
        query: 'method="${__span.tags.method}"'
      tracesToMetrics:
        datasourceUid: 'prom'
        spanStartTimeShift: '1h'
        spanEndTimeShift: '-1h'
        tags: [{ key: 'service.name', value: 'service' }, { key: 'job' }]
        queries:
          - name: 'Sample query'
            query: 'sum(rate(traces_spanmetrics_latency_bucket{$__tags}[5m]))'
      nodeGraph:
        enabled: true
      spanBar:
        type: 'None'
    secureJsonData:
      basicAuthPassword: my_password
```

## Query the data source

You can query and display traces from Jaeger via [Explore]({{< relref "../../explore" >}}).

This topic explains configuration and queries specific to the Jaeger data source.
For general documentation on querying data sources in Grafana, see [Query and transform data]({{< relref "../../panels-visualizations/query-transform-data" >}}).

### Query by search

**To search for traces:**

1. Select **Search** from the **Query** type selector.
1. Fill out the search form:

| Name             | Description                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Service**      | Returns a list of services.                                                                                                       |
| **Operation**    | Populated when you select a service with related operations. Select `All` to query all operations.                                |
| **Tags**         | Sets tags with values in the [logfmt](https://brandur.org/logfmt) format, such as `error=true db.statement="select * from User"`. |
| **Min Duration** | Filters all traces with a duration higher than the set value. Possible values are `1.2s, 100ms, 500us`.                           |
| **Max Duration** | Filters all traces with a duration lower than the set value. Possible values are `1.2s, 100ms, 500us`.                            |
| **Limit**        | Limits the number of traces returned.                                                                                             |

{{< figure src="/static/img/docs/explore/jaeger-search-form.png" class="docs-image--no-shadow" caption="Screenshot of the Jaeger query editor" >}}

### Query by trace ID

To query a particular trace:

1. Select the **TraceID** query type.
1. Enter the trace's ID into the **Trace ID** field.

{{< figure src="/static/img/docs/explore/jaeger-trace-id.png" class="docs-image--no-shadow" caption="Screenshot of the Jaeger query editor with TraceID selected" >}}

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

## Span Filters

> **Note:** This feature is behind the `newTraceView` [feature toggle]({{< relref "../../setup-grafana/configure-grafana#feature_toggles" >}}).
> If you use Grafana Cloud, open a [support ticket in the Cloud Portal](/profile/org#support) to access this feature.

![Screenshot of span filtering](/media/docs/tempo/screenshot-grafana-tempo-span-filters.png)

Allows you to filter your spans in the trace timeline viewer. The more filters you add, the more specific are the filtered spans.

You can add one or more of the following filters:

- Service name,
- Span name,
- Duration,
- Tags (which include tags, process tags, and log fields).

## Link to a trace ID from logs

You can link to Jaeger traces from logs in Loki, Elasticsearch, Splunk, and other logs data sources by configuring an internal link.

To configure this feature, see the [Derived fields]({{< relref "../loki#configure-derived-fields" >}}) section of the Loki data source docs or the [Data links]({{< relref "../elasticsearch#data-links" >}}) section of the Elasticsearch or Splunk data source docs.

## Link to a trace ID from metrics

You can link to Jaeger traces from metrics in Prometheus data sources by configuring an exemplar.

To configure this feature, see the [introduction to exemplars]({{< relref "docs/grafana/latest/fundamentals/exemplars" >}}) documentation.
