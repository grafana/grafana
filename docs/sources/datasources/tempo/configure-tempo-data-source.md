---
description: Guide for configuring Tempo in Grafana
keywords:
  - grafana
  - tempo
  - guide
  - tracing
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure Tempo
title: Configure the Tempo data source
weight: 200
refs:
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  build-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
  node-graph:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/node-graph/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/node-graph/
  exemplars:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/
  explore-trace-integration:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/trace-integration/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/trace-integration/
  variable-syntax:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
---

# Configure the Tempo data source

The Tempo data source sets how Grafana connects to your Tempo database and lets you configure features and integrations with other telemetry signals.

To configure basic settings for the Tempo data source, complete the following steps:

1.  Click **Connections** in the left-side menu.
1.  Under Your connections, click **Data sources**.
1.  Enter `Tempo` in the search bar.
1.  Select **Tempo**.

1.  On the **Settings** tab, set the data source's basic configuration options:

    | Name           | Description                                                              |
    | -------------- | ------------------------------------------------------------------------ |
    | **Name**       | Sets the name you use to refer to the data source in panels and queries. |
    | **Default**    | Sets the data source that's pre-selected for new panels.                 |
    | **URL**        | Sets the URL of the Tempo instance, such as `http://tempo`.              |
    | **Basic Auth** | Enables authentication to the Tempo data source.                         |
    | **User**       | Sets the user name for basic authentication.                             |
    | **Password**   | Sets the password for basic authentication.                              |

You can also configure settings specific to the Tempo data source.

This video explains how to add data sources, including Loki, Tempo, and Mimir, to Grafana and Grafana Cloud. Tempo data source set up starts at 4:58 in the video.

{{< youtube id="cqHO0oYW6Ic" start="298" >}}

## Streaming

<!-- The traceQLStreaming toggle will be deprecated in Grafana 11.2 and removed in 11.3. -->

Streaming enables TraceQL query results to be displayed as they become available. Without streaming, no results are displayed until all results have returned.

{{< docs/public-preview product="TraceQL streaming results" >}}

### Requirements

To use streaming, you need to:

- Be running Tempo version 2.2 or newer, or Grafana Enterprise Traces (GET) version 2.2 or newer, or be using Grafana Cloud Traces.
- For self-managed Tempo or GET instances: If your Tempo or GET instance is behind a load balancer or proxy that doesn't supporting gRPC or HTTP2, streaming may not work and should be disabled.

### Activate streaming

For streaming to work for a particular Tempo data source, set your Grafana's `traceQLStreaming` [feature toggle](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/) to true and set **Streaming** to enabled in your Tempo data source configuration.

![Streaming section in Tempo data source](/media/docs/grafana/data-sources/tempo-data-source-streaming-v11.2.png)

If you are using Grafana Cloud, the `traceQLStreaming` feature toggle is already set to `true` by default.

If the Tempo data source is set to allow streaming but the `traceQLStreaming` feature toggle is set to `false` in Grafana, no streaming will occur.

If the data source has streaming disabled and `traceQLStreaming` is set to `true`, no streaming will happen for that data source.

## Trace to logs

The **Trace to logs** setting configures [trace to logs](ref:explore-trace-integration) that's available when you integrate Grafana with Tempo.

![Trace to logs settings](/media/docs/tempo/tempo-trace-to-logs-9-4.png)

There are two ways to configure the trace to logs feature:

- Use a simplified configuration with default query, or
- Configure a custom query where you can use a [template language](ref:variable-syntax) to interpolate variables from the trace or span.

### Use a simple configuration

1. Select the target data source from the drop-down list.

   You can also click **Open advanced data source picker** to see more options, including adding a data source.

1. Set start and end time shift. As the logs timestamps may not exactly match the timestamps of the spans in trace it may be necessary to search in larger or shifted time range to find the desired logs.
1. Select which tags to use in the logs query.
   The tags you configure must be present in the span's attributes or resources for a trace to logs span link to appear. You can optionally configure a new name for the tag. This is useful, for example, if the tag has dots in the name and the target data source does not allow using dots in labels. In that case, you can for example remap `http.status` (the span attribute) to `http_status` (the data source field). "Data source" in this context can refer to Loki, or another log data source.
1. Optional: If your logs consistently trace or span IDs, you can use one or both of the **Filter by trace ID** and **Filter by span ID** settings.

### Configure a custom query

1. Select the target data source from the drop-down list.

   You can also click **Open advanced data source picker** to see more options, including adding a data source.

1. Set start and end time shift. As the logs timestamps may not exactly match the timestamps of the spans in the trace it may be necessary to widen or shift the time range to find the desired logs.
1. Optional: Select tags to map. These tags can be used in the custom query with `${__tags}` variable. This variable interpolates the mapped tags as list in an appropriate syntax for the data source. Only the tags that were present in the span are included; tags that aren't present are omitted You can also configure a new name for the tag. This is useful in cases where the tag has dots in the name and the target data source doesn't allow dots in labels. For example, you can remap `http.status` to `http_status`. If you don't map any tags here, you can still use any tag in the query, for example, `method="${__span.tags.method}"`. You can learn more about custom query variables [here](/docs/grafana/latest/datasources/tempo/configure-tempo-data-source/#custom-query-variables).
1. Skip **Filter by trace ID** and **Filter by span ID** settings as these cannot be used with a custom query.
1. Switch on **Use custom query**.
1. Specify a custom query to be used to query the logs. You can use various variables to make that query relevant for current span. The link will only be shown only if all the variables are interpolated with non-empty values to prevent creating an invalid query.

### Configure trace to logs

The following table describes the ways in which you can configure your trace to logs settings:

| Setting name              | Description                                                                                                                                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Data source**           | Defines the target data source. You can select Loki or any compatible log store.                                                                                                                                                                                                                             |
| **Span start time shift** | Shifts the start time for the logs query, based on the span's start time. You can use time units, such as `5s`, `1m`, `3h`. To extend the time to the past, use a negative value. Default: `0`.                                                                                                              |
| **Span end time shift**   | Shifts the end time for the logs query, based on the span's end time. You can use time units. Default: `0`.                                                                                                                                                                                                  |
| **Tags**                  | Defines the tags to use in the logs query. Default: `cluster`, `hostname`, `namespace`, `pod`, `service.name`, `service.namespace`. You can change the tag name for example to remove dots from the name if they are not allowed in the target data source. For example, map `http.status` to `http_status`. |
| **Filter by trace ID**    | Toggles whether to append the trace ID to the logs query.                                                                                                                                                                                                                                                    |
| **Filter by span ID**     | Toggles whether to append the span ID to the logs query.                                                                                                                                                                                                                                                     |
| **Use custom query**      | Toggles use of custom query with interpolation.                                                                                                                                                                                                                                                              |
| **Query**                 | Input to write custom query. Use variable interpolation to customize it with variables from span.                                                                                                                                                                                                            |

## Trace to metrics

The **Trace to metrics** setting configures the [trace to metrics feature](/blog/2022/08/18/new-in-grafana-9.1-trace-to-metrics-allows-users-to-navigate-from-a-trace-span-to-a-selected-data-source/) available when integrating Grafana with Tempo.

{{< youtube id="TkapvLeMMpc" >}}

There are two ways to configure the trace to metrics feature:

- Use a basic configuration with a default query, or
- Configure one or more custom queries where you can use a [template language](ref:variable-syntax) to interpolate variables from the trace or span.

Refer to the Trace to metrics configuration options section to learn about the available options.

### Set up a simple configuration

To use a simple configuration, follow these steps:

1. Select a metrics data source from the **Data source** drop-down.
1. Optional: Change **Span start time shift** and **Span end time shift**. You can change one or both of these settings. The default start time shift is -2 minutes and 2 minutes for end time shift.
1. Optional: Choose any tags to use in the query. If left blank, the default values of `cluster`, `hostname`, `namespace`, `pod`, `service.name` and `service.namespace` are used.

   The tags you configure must be present in the spans attributes or resources for a trace to metrics span link to appear. You can optionally configure a new name for the tag. This is useful for example if the tag has dots in the name and the target data source doesn't allow using dots in labels. In that case you can for example remap `service.name` to `service_name`.

1. Don't select **Add query**.
1. Select **Save and Test**.

### Set up custom queries

To use custom queries, you need to configure the tags you’d like to include in the linked queries.
For each tag, the key is the span attribute name.
In cases where the attribute name would result in an invalid metrics query or doesn’t exactly match the desired label name, you can enter the label name as the second value.
For example, you could map the attribute `k8s.pod` to the label `pod`.

You can interpolate the configured tags using the `$__tags` keyword.
For example, when you configure the query `requests_total{$__tags}` with the tags `k8s.pod=pod` and `cluster`, it results in `requests_total{pod="nginx-554b9", cluster="us-east-1"}`.
The label values are dynamically inserted based on the span attributes’ values.

You can link to any metric you’d like, but metrics for span durations, counts, and errors filtered by service or span are a great starting point.

To use custom queries with the configuration, follow these steps:

1. Select a metrics data source from the **Data source** drop-down.
1. Optional: Choose any tags to use in the query. If left blank, the default values of `cluster`, `hostname`, `namespace`, `pod`, `service.name` and `service.namespace` are used.

   These tags can be used in the custom query with `${__tags}` variable. This variable interpolates the mapped tags as list in an appropriate syntax for the data source and will only include the tags that were present in the span omitting those that weren’t present. You can optionally configure a new name for the tag. This is useful in cases where the tag has dots in the name and the target data source doesn't allow using dots in labels. For example, you can remap `service.name` to `service_name` in such a case. If you don’t map any tags here, you can still use any tag in the query like this `method="${__span.tags.method}"`. You can learn more about custom query variables [here](/docs/grafana/latest/datasources/tempo/configure-tempo-data-source/#custom-query-variables).

1. Click **Add query** to add a custom query.
1. Specify a custom query to be used to query metrics data.

   Each linked query consists of:

   - **Link Label:** _(Optional)_ Descriptive label for the linked query.
   - **Query:** The query ran when navigating from a trace to the metrics data source.
     Interpolate tags using the `$__tags` keyword.
     For example, when you configure the query `requests_total{$__tags}`with the tags `k8s.pod=pod` and `cluster`, the result looks like `requests_total{pod="nginx-554b9", cluster="us-east-1"}`.

1. Select **Save and Test**.

### Trace to metrics configuration options

| Setting name              | Description                                                                                                                                                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data source**           | Defines the target data source.                                                                                                                                                                                                                                 |
| **Span start time shift** | Shifts the start time for the metrics query, based on the span's start time. You can use time units, such as `5s`, `1m`, `3h`. To extend the time to the past, use a negative value. Default: `0`.                                                              |
| **Span end time shift**   | Shifts the end time for the metrics query, based on the span's end time. You can use time units. Default: `0`.                                                                                                                                                  |
| **Tags**                  | Defines the tags used in linked queries. The key sets the span attribute name, and the optional value sets the corresponding metric label name. For example, you can map `k8s.pod` to `pod`. To interpolate these tags into queries, use the `$__tags` keyword. |
| **Link Label**            | _(Optional)_ Descriptive label for the linked query.                                                                                                                                                                                                            |
| **Query**                 | Input to write a custom query. Use variable interpolation to customize it with variables from span.                                                                                                                                                             |

## Trace to profiles

[//]: # 'Shared content for Trace to profiles in the Tempo data source'

{{< docs/shared source="grafana" lookup="datasources/tempo-traces-to-profiles.md" leveloffset="+1" version="<GRAFANA_VERSION>" >}}

## Custom query variables

To use a variable in your trace to logs, metrics, or profiles, you need to wrap it in `${}`.
For example, `${__span.name}`.

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

## Service Graph

The **Service Graph** setting configures the [Service Graph](/docs/tempo/latest/metrics-generator/service_graphs/enable-service-graphs/) feature.

Configure the **Data source** setting to define in which Prometheus instance the Service Graph data is stored.

To use the Service Graph, refer to the [Service Graph documentation](#use-the-service-graph).

## Node Graph

The **Node Graph** setting enables the [node graph visualization](ref:node-graph), which is disabled by default.

Once enabled, Grafana displays the node graph above the trace view.

## Tempo search

The **Search** setting configures [Tempo search](/docs/tempo/latest/configuration/#search).

You can configure the **Hide search** setting to hide the search query option in **Explore** if search is not configured in the Tempo instance.

## TraceID query

The **TraceID query** setting modifies how TraceID queries are run. The time range can be used when there are performance issues or timeouts since it will narrow down the search to the defined range. This setting is disabled by default.

You can configure this setting as follows:

| Name                  | Description                                                 |
| --------------------- | ----------------------------------------------------------- |
| **Enable time range** | Use a time range in the TraceID query. Default: `disabled`. |
| **Time shift start**  | Time shift for start of search. Default: `30m`.             |
| **Time shift end**    | Time shift for end of search. Default: `30m`.               |

## Span bar

The **Span bar** setting helps you display additional information in the span bar row.

You can choose one of three options:

| Name         | Description                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **None**     | Adds nothing to the span bar row.                                                                                                |
| **Duration** | _(Default)_ Displays the span duration on the span bar row.                                                                      |
| **Tag**      | Displays the span tag on the span bar row. You must also specify which tag key to use to get the tag value, such as `component`. |

## Provision the data source

You can define and configure the Tempo data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning and available configuration options, refer to [Provisioning Grafana](ref:provisioning-data-sources).

Example provision YAML file:

```yaml
apiVersion: 1

datasources:
  - name: Tempo
    type: tempo
    uid: EbPG8fYoz
    url: http://localhost:3200
    access: proxy
    basicAuth: false
    jsonData:
      tracesToLogsV2:
        # Field with an internal link pointing to a logs data source in Grafana.
        # datasourceUid value must match the uid value of the logs data source.
        datasourceUid: 'loki'
        spanStartTimeShift: '-1h'
        spanEndTimeShift: '1h'
        tags: ['job', 'instance', 'pod', 'namespace']
        filterByTraceID: false
        filterBySpanID: false
        customQuery: true
        query: 'method="$${__span.tags.method}"'
      tracesToMetrics:
        datasourceUid: 'prom'
        spanStartTimeShift: '1h'
        spanEndTimeShift: '-1h'
        tags: [{ key: 'service.name', value: 'service' }, { key: 'job' }]
        queries:
          - name: 'Sample query'
            query: 'sum(rate(traces_spanmetrics_latency_bucket{$$__tags}[5m]))'
      tracesToProfiles:
        datasourceUid: 'grafana-pyroscope-datasource'
        tags: ['job', 'instance', 'pod', 'namespace']
        profileTypeId: 'process_cpu:cpu:nanoseconds:cpu:nanoseconds'
        customQuery: true
        query: 'method="$${__span.tags.method}"'
      serviceMap:
        datasourceUid: 'prometheus'
      nodeGraph:
        enabled: true
      search:
        hide: false
      traceQuery:
        timeShiftEnabled: true
        spanStartTimeShift: '1h'
        spanEndTimeShift: '-1h'
      spanBar:
        type: 'Tag'
        tag: 'http.path'
```
