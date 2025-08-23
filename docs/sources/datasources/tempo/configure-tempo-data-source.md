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
    - pattern: /docs/grafana-cloud/provision
      destination: /docs/grafana/latest/administration/provisioning/#data-sources
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
---

# Configure a Tempo data source

The Tempo data source sets how Grafana connects to your Tempo database and lets you configure features and integrations with other telemetry signals.

You can configure the data source using either the data source interface in Grafana or using a configuration file.
This page explains how to set up and enable the data source capabilities using Grafana.

If you're using your own installation of Grafana, you can provision the Tempo data source using a YAML configuration file.

Depending upon your tracing environment, you may have more than one Tempo instance.
Grafana supports multiple Tempo data sources.

## Before you begin

To configure a Tempo data source, you need administrator rights to your Grafana instance and a Tempo instance configured to send tracing data to Grafana.

If you're provisioning a Tempo data source, then you also need administrative rights on the server hosting your Grafana instance.
Refer to [Provision the data source](#provision-the-data-source) for next steps.

![Provisioned data source warning](/media/docs/grafana/data-sources/tempo/tempo-data-source-provisioned-error.png)

## Add or modify a data source

You can use these procedures to configure a new Tempo data source or to edit an existing one.

{{< admonition type="note" >}}
You can't modify a provisioned data source using the Tempo data source settings in Grafana Cloud.

If you want to modify any capabilities of a provisioned data source, you can clone the provisioned data source and then edit the new data source in the Grafana UI.
Refer to [Clone a provisioned data source for Grafana Cloud](#clone-a-provisioned-data-source-for-grafana-cloud) for more information.
{{< /admonition >}}

### Add a new data source

Follow these steps to set up a new Tempo data source:

1. Select **Connections** in the main menu.
1. Enter `Tempo` in the search bar.
1. Select **Tempo**.
1. Select **Add new data source** in the top-right corner of the page.
1. On the **Settings** tab, complete the **Name**, **Connection**, and **Authentication** sections.

- Use the **Name** field to specify the name used for the data source in panels, queries, and Explore. Toggle the **Default** switch for the data source to be pre-selected for new panels.
- Under **Connection**, enter the **URL** of the Tempo instance, for example, `https://example.com:4100`.
- Complete the [**Authentication** section](#authentication).

1. Optional: Configure other sections to add capabilities to your tracing data. Refer to the additional procedures for instructions.
1. Select **Save & test**.

### Update an existing data source

To modify an existing Tempo data source:

1. Select **Connections** in the main menu.
1. Select **Data sources** to view a list of configured data sources.
1. Select the Tempo data source you wish to modify.
1. Configure or update additional sections to add capabilities to your tracing data. Refer to the additional procedures for instructions.
1. After completing your updates, select **Save & test**.

## Authentication

Use this section to select an authentication method to access the data source.

{{< admonition type="note" >}}
Use Transport Layer Security (TLS) for an additional layer of security when working with Tempo.
For additional information on setting up TLS encryption with Tempo, refer to [Configure TLS communication](https://grafana.com/docs/tempo/<TEMPO_VERSION>/configuration/network/tls/) and [Tempo configuration](https://grafana.com/docs/tempo/<TEMPO_VERSION>/configuration/).
{{< /admonition >}}

[//]: # 'Shared content for authentication section procedure in data sources'

{{< docs/shared source="grafana" lookup="datasources/datasouce-authentication.md" leveloffset="+2" version="<GRAFANA_VERSION>" >}}

## Streaming

Streaming enables TraceQL query results to be displayed as they become available.
Without streaming, no results are displayed until all results have returned.

To use streaming, you need to:

- Run Tempo version 2.2 or later, or Grafana Enterprise Traces (GET) version 2.2 or later, or use Grafana Cloud Traces.
- Tempo must have `stream_over_http_enabled: true` for streaming to work.

  For more information, refer to [Tempo gRPC API](https://grafana.com/docs/tempo/<TEMPO_VERSION>/api_docs/#tempo-grpc-api).

- For self-managed Tempo or GET instances: If your Tempo or GET instance is behind a load balancer or proxy that doesn't supporting gRPC or HTTP2, streaming may not work and should be deactivated.

### Activate streaming

Streaming is available in Grafana and Grafana Cloud.
You can activate streaming by turning the **Streaming** toggle to on in the Tempo data source.

![Streaming section in Tempo data source](/media/docs/grafana/data-sources/tempo-data-source-streaming-v11.2.png)

When streaming is active, it's shows as **Enabled** in **Explore**.
To check the status, select Explore in the menu, select your Tempo data source, and expand the **Options** section.

![The Explore screen shows the Tempo data source with streaming active](/media/docs/grafana/data-sources/tempo/tempo-query-stream-active.png)

## Trace to logs

The **Trace to logs** setting configures [trace to logs](ref:explore-trace-integration) that's available when you integrate Grafana with Tempo.
Trace to logs can also be used with other tracing data sources, such as Jaeger and Zipkin.

![Trace to logs settings](/media/docs/grafana/data-sources/tempo/tempo-data-source-trace-to-logs.png)

You can configure a custom query where you can use a [template language](ref:variable-syntax) to interpolate variables from the trace or span.

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

Refer to the [Trace to metrics configuration options](#trace-tometrics-configuration-options) section to learn about the available options.

![Trace to metrics settings in the Tempo data source](/media/docs/grafana/data-sources/tempo/tempo-data-source-trace-to-metrics.png)

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

{{< docs/shared source="grafana" lookup="datasources/tempo-traces-to-profiles.md" leveloffset="+2" version="<GRAFANA_VERSION>" >}}

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

## Additional settings

Use the down arrow to expand the **Additional settings** section to view these options.

### Advanced HTTP settings

The Grafana Proxy deletes forwarded cookies. Use the **Allowed cookies** field to specify cookies by name that should be forwarded to the data source.

The **Timeout** field sets the HTTP request timeout in seconds.

### Service graph

The **Service graph** setting configures the [Service Graph](/docs/tempo/latest/metrics-generator/service_graphs/enable-service-graphs/) data.

Configure the **Data source** setting to define in which Prometheus instance the Service Graph data is stored.

To use the Service Graph, refer to the [Service Graph documentation](#use-the-service-graph).

### Node graph

The **Node graph** setting enables the [node graph visualization](ref:node-graph), which isn't activated by default.

Once activated, Grafana displays the node graph above the trace view.

### Tempo search

The **Search** setting configures [Tempo search](/docs/tempo/latest/configuration/#search).

You can configure the **Hide search** setting to hide the search query option in **Explore** if search is not configured in the Tempo instance.

### TraceID query

The **TraceID query** setting modifies how TraceID queries are run.
The time range can be used when there are performance issues or timeouts since it narrows down the search to the defined range.
This setting is disabled by default.

You can configure this setting as follows:

| Name                  | Description                                                 |
| --------------------- | ----------------------------------------------------------- |
| **Enable time range** | Use a time range in the TraceID query. Default: `disabled`. |
| **Time shift start**  | Time shift for start of search. Default: `30m`.             |
| **Time shift end**    | Time shift for end of search. Default: `30m`.               |

### Span bar

The **Span bar** setting helps you display additional information in the span bar row.

You can choose one of three options:

| Name         | Description                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **None**     | Adds nothing to the span bar row.                                                                                                |
| **Duration** | _(Default)_ Displays the span duration on the span bar row.                                                                      |
| **Tag**      | Displays the span tag on the span bar row. You must also specify which tag key to use to get the tag value, such as `component`. |

### Tag limit

The **Tag limit** setting modifies the max number of tags and tag values to retrieve from Tempo. Default: 5000

### Private data source connect

[//]: # 'Shared content for authentication section procedure in data sources'

{{< docs/shared source="grafana" lookup="datasources/datasouce-private-ds-connect.md" leveloffset="+2" version="<GRAFANA_VERSION>" >}}

## Provision the data source

You can define and configure the Tempo data source in YAML files as part of the Grafana provisioning system.
Provisioning is primarily used Grafana instances that don't use Grafana Cloud.

You can use version control, like git, to track and manage file changes.
Changes can be updated or rolled back as needed.

For more information about provisioning and available configuration options, refer to [Provisioning Grafana](ref:provisioning-data-sources).

{{< admonition type="note" >}}
You can't modify a provisioned data source using the Tempo data source settings in Grafana.
Grafana displays a message for provisioned data sources.
{{< /admonition >}}

### Example file

This example provision YAML file sets up the equivalents of the options available in the Tempo data source user interface.

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
        spanStartTimeShift: '-1h'
        spanEndTimeShift: '1h'
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
        spanStartTimeShift: '-1h'
        spanEndTimeShift: '1h'
      spanBar:
        type: 'Tag'
        tag: 'http.path'
      streamingEnabled:
        search: true
```

### Clone a provisioned data source for Grafana Cloud

If you have a data source that is provisioned by a configuration file in Grafana Cloud, you can clone that provisioned data source and then edit the new data source in the Grafana UI.

For example, let's say you want to edit the **Trace to log**s settings in your Tempo data source that is provisioned on Grafana Cloud.
You'd like to enable traceID and spanID but you can't because the data source is provisioned.
You could enable these capabilities in a cloned data source.

To clone a provisioned data source, follow these steps:

1. Create a viewer [Cloud Access Policy token](https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/) in the Grafana Cloud Portal, making sure it has read permissions at least for the data types you are trying to clone.
1. [Create a new data source](#add-a-new-data-source) of the same type you want to clone.
1. Copy all of the settings from the existing provisioned data source into the new data source while replacing the password with the API key you created.

The easiest way to do this is to open separate browser windows with the provisioned data source in one and the newly created data source in another.

Of course, after copying the HTTP and Auth section details, pasting the Cloud Access Policy token into the Password field, and changing any of the other options that you want, you can save and test the data source.
