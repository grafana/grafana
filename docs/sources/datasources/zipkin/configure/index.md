---
aliases:
  - ../../data-sources/zipkin/
description: Configure the Zipkin data source in Grafana
keywords:
  - grafana
  - zipkin
  - tracing
  - configuration
  - provisioning
  - terraform
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure
title: Configure the Zipkin data source
weight: 100
review_date: 2026-04-08
---

# Configure the Zipkin data source

This document explains how to configure the Zipkin data source in Grafana, including connection settings, authentication, trace-to-logs and trace-to-metrics integrations, and provisioning with YAML or Terraform.

## Before you begin

Before configuring the data source, ensure you have:

- **Grafana permissions:** Organization administrator role
- **Zipkin instance:** A running Zipkin instance accessible from your Grafana server

## Add the data source

To add the Zipkin data source:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**.
1. Type `Zipkin` in the search bar.
1. Select **Zipkin**.
1. Click **Add new data source**.

## Configure settings

The following table describes the basic configuration settings for the Zipkin data source.

| Setting     | Description                                                              |
| ----------- | ------------------------------------------------------------------------ |
| **Name**    | The name used to refer to the data source in panels and queries.         |
| **Default** | Toggle to make this the default data source for new panels.              |
| **URL**     | The URL of the Zipkin instance, such as `http://localhost:9411`.          |

## Authentication

The Zipkin data source supports the following authentication methods:

- **Basic authentication:** Provide a username and password to authenticate with the Zipkin instance.
- **TLS client authentication:** Configure client certificates for mutual TLS.
- **Forward OAuth identity:** Forward the user's OAuth token to the Zipkin instance.
- **With credentials:** Send credentials (cookies, TLS client certificates) with cross-site requests.

You can also configure custom headers and TLS settings in the **Advanced HTTP settings** section, which is located inside **Additional settings**.

## Trace to logs

{{< figure src="/media/docs/tempo/tempo-trace-to-logs-9-4.png" max-width="800px" class="docs-image--no-shadow" caption="Trace to logs settings" >}}

{{< admonition type="note" >}}
If you use Grafana Cloud, open a [support ticket in the Cloud Portal](/profile/org#support) to access this feature.
{{< /admonition >}}

The **Trace to logs** setting configures the [trace to logs feature](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/trace-integration/) that is available when you integrate Grafana with Zipkin. This feature lets you navigate from a span in a trace view directly to the relevant logs.

There are two ways to configure the trace to logs feature:

- Use a simplified configuration with a default query, or
- Configure a custom query where you can use a [template language](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/) to interpolate variables from the trace or span.

### Use a simple configuration

1. Select the target data source from the drop-down list.

   You can also click **Open advanced data source picker** to see more options, including adding a data source.

1. Set start and end time shift. Since the log timestamps may not exactly match the timestamps of the spans in the trace, you may need to widen or shift the time range to find the desired logs.
1. Select which tags to use in the logs query. The tags you configure must be present in the span attributes or resources for a trace to logs span link to appear. You can optionally configure a new name for the tag. This is useful if the tag has dots in the name and the target data source doesn't allow dots in labels. For example, you can remap `http.status` to `http_status`.
1. Optionally, switch on the **Filter by trace ID** and/or **Filter by span ID** setting to further filter the logs if your logs consistently contain trace or span IDs.

### Configure a custom query

1. Select the target data source from the drop-down list.

   You can also click **Open advanced data source picker** to see more options, including adding a data source.

1. Set start and end time shift. Since the log timestamps may not exactly match the timestamps of the spans in the trace, you may need to widen or shift the time range to find the desired logs.
1. Optionally, select tags to map. These tags can be used in the custom query with the `${__tags}` variable. This variable interpolates the mapped tags as a list in an appropriate syntax for the data source and only includes tags that are present in the span. You can optionally configure a new name for the tag. This is useful when the tag has dots in the name and the target data source doesn't allow dots in labels. For example, you can remap `http.status` to `http_status`. If you don't map any tags here, you can still use any tag in the query like this: `method="${__span.tags.method}"`.
1. Skip **Filter by trace ID** and **Filter by span ID** settings as these can't be used with a custom query.
1. Switch on **Use custom query**.
1. Specify a custom query to be used to query the logs. You can use various variables to make the query relevant for the current span. The link only appears if all the variables are interpolated with non-empty values to prevent creating an invalid query.

### Variables for custom queries

To use a variable, wrap it in `${}`. For example: `${__span.name}`.

| Variable name          | Description                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **\_\_tags**           | This variable uses the tag mapping from the UI to create a label matcher string in the specific data source syntax. The variable only uses tags that are present in the span. The link is still created even if only one of those tags is present in the span. You can use this if all tags aren't required for the query to be useful. |
| **\_\_span.spanId**    | The ID of the span.                                                                                                                                                                                                                                                                                                                      |
| **\_\_span.traceId**   | The ID of the trace.                                                                                                                                                                                                                                                                                                                     |
| **\_\_span.duration**  | The duration of the span.                                                                                                                                                                                                                                                                                                                |
| **\_\_span.name**      | The name of the span.                                                                                                                                                                                                                                                                                                                    |
| **\_\_span.tags**      | Namespace for the tags in the span. To access a specific tag named `version`, you would use `${__span.tags.version}`. If the tag contains a dot, access it as `${__span.tags["http.status"]}`.                                                                                                                                           |
| **\_\_trace.traceId**  | The ID of the trace.                                                                                                                                                                                                                                                                                                                     |
| **\_\_trace.duration** | The duration of the trace.                                                                                                                                                                                                                                                                                                               |
| **\_\_trace.name**     | The name of the trace.                                                                                                                                                                                                                                                                                                                   |

### Trace to logs settings

The following table describes the trace to logs configuration options.

| Setting name              | Description                                                                                                                                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Data source**           | Defines the target data source. You can select Loki, Elasticsearch, Splunk, OpenSearch, FalconLogScale, Google Cloud Logging, and VictoriaMetrics Logs data sources.                                                                                                                                         |
| **Span start time shift** | Shifts the start time for the logs query, based on the span's start time. You can use time units, such as `5s`, `1m`, `3h`. To extend the time to the past, use a negative value. Default: `0`.                                                                                                              |
| **Span end time shift**   | Shifts the end time for the logs query, based on the span's end time. You can use time units. Default: `0`.                                                                                                                                                                                                  |
| **Tags**                  | Defines the tags to use in the logs query. Default: `cluster`, `hostname`, `namespace`, `pod`, `service.name`, `service.namespace`. You can change the tag name to remove dots from the name if they aren't allowed in the target data source. For example, map `http.status` to `http_status`.               |
| **Filter by trace ID**    | Toggles whether to append the trace ID to the logs query.                                                                                                                                                                                                                                                    |
| **Filter by span ID**     | Toggles whether to append the span ID to the logs query.                                                                                                                                                                                                                                                     |
| **Use custom query**      | Toggles use of custom query with interpolation.                                                                                                                                                                                                                                                              |
| **Query**                 | Input to write a custom query. Use variable interpolation to customize it with variables from the span.                                                                                                                                                                                                      |

## Trace to metrics

The **Trace to metrics** setting lets you navigate from a span in a trace view to a metrics query in a configured metrics data source.

To configure trace to metrics:

1. Select the target data source from the drop-down list.

   You can also click **Open advanced data source picker** to see more options, including adding a data source.

1. Create any desired linked queries.

| Setting name    | Description                                                                                                                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data source** | Defines the target data source.                                                                                                                                                                                                                                 |
| **Tags**        | Defines the tags used in linked queries. The key sets the span attribute name, and the optional value sets the corresponding metric label name. For example, you can map `k8s.pod` to `pod`. To interpolate these tags into queries, use the `$__tags` keyword. |

Each linked query consists of:

- **Link Label:** _(Optional)_ Descriptive label for the linked query.
- **Query:** The query run when navigating from a trace to the metrics data source. Interpolate tags using the `$__tags` keyword. For example, when you configure the query `requests_total{$__tags}` with the tags `k8s.pod=pod` and `cluster`, the result looks like `requests_total{pod="nginx-554b9", cluster="us-east-1"}`.

## Additional settings

The **Additional settings** section is collapsible and contains optional settings for the node graph, span bar, advanced HTTP configuration, and secure SOCKS proxy (when enabled in your Grafana configuration).

### Node graph

The **Enable node graph** toggle enables the [Node graph visualization](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/node-graph/), which is disabled by default.

After you enable it, Grafana displays the node graph above the trace view.

### Span bar

The **Span bar** setting lets you display additional information in the span bar row.

The **Label** drop-down has three options:

| Label        | Description                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **None**     | Adds nothing to the span bar row.                                                                                                    |
| **Duration** | _(Default)_ Displays the span duration on the span bar row.                                                                          |
| **Tag**      | Displays the span tag on the span bar row. Enter the **Tag key** to specify which tag value to display, such as `component`. |

## Verify the connection

Click **Save & test** to verify the connection. A successful connection displays the message **Data source is working**.

If you encounter errors, refer to [Troubleshoot Zipkin data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/troubleshooting/).

## Provision the data source

You can define and configure the data source in YAML files as part of the Grafana provisioning system.
For more information about provisioning and available configuration options, refer to [Provisioning Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources).

### Provisioning example

```yaml
apiVersion: 1

datasources:
  - name: Zipkin
    type: zipkin
    uid: zipkin-ds
    url: http://localhost:9411
    access: proxy
    basicAuth: true
    basicAuthUser: my_user
    readOnly: false
    isDefault: false
    jsonData:
      tracesToLogsV2:
        datasourceUid: 'loki'
        spanStartTimeShift: '1h'
        spanEndTimeShift: '-1h'
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
      nodeGraph:
        enabled: true
      spanBar:
        type: 'None'
    secureJsonData:
      basicAuthPassword: my_password
```

## Configure with Terraform

You can configure the Zipkin data source using [Terraform](https://www.terraform.io/) with the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

For more information about provisioning resources with Terraform, refer to the [Grafana as code using Terraform](https://grafana.com/docs/grafana-cloud/developer-resources/infrastructure-as-code/terraform/) documentation.

### Basic Terraform example

The following example creates a basic Zipkin data source:

```hcl
resource "grafana_data_source" "zipkin" {
  name = "Zipkin"
  type = "zipkin"
  url  = "http://localhost:9411"
}
```

### Terraform example with trace to logs

The following example includes a trace to logs configuration that links traces to a Loki data source:

```hcl
resource "grafana_data_source" "zipkin" {
  name = "Zipkin"
  type = "zipkin"
  url  = "http://localhost:9411"

  json_data_encoded = jsonencode({
    tracesToLogsV2 = {
      datasourceUid    = grafana_data_source.loki.uid
      spanStartTimeShift = "1h"
      spanEndTimeShift   = "-1h"
      filterByTraceID  = true
      filterBySpanID   = false
      tags = [
        { key = "service.name", value = "service" },
        { key = "namespace" }
      ]
    }
    nodeGraph = {
      enabled = true
    }
  })
}
```

### Terraform example with basic authentication

The following example includes basic authentication:

```hcl
resource "grafana_data_source" "zipkin" {
  name = "Zipkin"
  type = "zipkin"
  url  = "http://localhost:9411"

  basic_auth_enabled  = true
  basic_auth_username = "zipkin_user"

  secure_json_data_encoded = jsonencode({
    basicAuthPassword = var.zipkin_password
  })

  json_data_encoded = jsonencode({
    nodeGraph = {
      enabled = true
    }
  })
}
```

For all available configuration options, refer to the [Grafana provider data source resource documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source).
