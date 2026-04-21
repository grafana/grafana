---
aliases:
  - ../../data-sources/jaeger/
description: Configure the Jaeger data source in Grafana
keywords:
  - grafana
  - jaeger
  - configuration
  - tracing
  - provisioning
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure
title: Configure the Jaeger data source
weight: 100
review_date: 2026-03-03
---

# Configure the Jaeger data source

This document explains how to configure the Jaeger data source in Grafana, including connection settings, authentication, trace correlation, and provisioning.

## Before you begin

Before configuring the data source, ensure you have:

- **Grafana permissions:** Organization administrator role
- **Jaeger instance:** A running Jaeger instance with an accessible query endpoint (default: `http://localhost:16686`)

## Add the data source

To add the Jaeger data source:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**.
1. Type `Jaeger` in the search bar.
1. Select **Jaeger**.
1. Click **Add new data source**.

## Connection settings

Configure the basic connection options for the data source.

| Setting     | Description                                                        |
| ----------- | ------------------------------------------------------------------ |
| **Name**    | The name used to refer to the data source in panels and queries.   |
| **Default** | Toggle to make this the default data source for new panels.        |
| **URL**     | The URL of your Jaeger instance, such as `http://localhost:16686`. |

## Authentication

The Jaeger data source supports the following authentication methods.

### Basic authentication

To use basic authentication:

1. Select **Basic auth** from the drop-down.
1. Enter the **User** name.
1. Enter the **Password**.

### Forward OAuth identity

Select **Forward OAuth identity** from the drop-down to forward the user's upstream OAuth identity to the data source. This is useful when Jaeger is behind an authenticating proxy.

### Custom headers

You can add custom HTTP headers to requests sent to the Jaeger instance. Use this to pass authorization tokens or other required headers.

To add custom headers, expand the **Additional settings** section and configure them under **Custom HTTP headers**.

### TLS configuration

To configure TLS/mTLS for the connection, expand the **Additional settings** section and configure the following options:

| Setting             | Description                                                 |
| ------------------- | ----------------------------------------------------------- |
| **TLS client auth** | Toggle to enable client certificate authentication.         |
| **With CA cert**    | Toggle to provide a custom CA certificate.                  |
| **Skip TLS verify** | Toggle to skip TLS certificate verification (testing only). |
| **Server name**     | Server name for TLS certificate validation.                 |

### Private data source connect

**Private data source connect** - _Only for Grafana Cloud users._

{{< admonition type="note" >}}
This section is only visible when the Grafana instance has the secure SOCKS proxy feature enabled.
{{< /admonition >}}

Private data source connect, or PDC, allows you to establish a private, secured connection between a Grafana Cloud instance, or stack, and data sources secured within a private network. Click the drop-down to locate the URL for PDC. For more information regarding Grafana PDC refer to [Private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) and [Configure Grafana private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc) for instructions on setting up a PDC connection.

Click **Manage private data source connect** to open your PDC connection page and view your configuration details.

## Trace to logs

{{< figure src="/media/docs/tempo/tempo-trace-to-logs-9-4.png" max-width="800px" class="docs-image--no-shadow" caption="Trace to logs configuration settings" >}}

The **Trace to logs** setting configures the [trace to logs feature](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/trace-integration/) that links trace spans to related log entries.

{{< admonition type="note" >}}
If you use Grafana Cloud, open a [support ticket in the Cloud Portal](/profile/org#support) to access this feature.
{{< /admonition >}}

There are two ways to configure trace to logs:

- **Simple configuration:** Use a default query with tag-based filtering.
- **Custom query:** Write a query using [template variable syntax](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/) to interpolate values from the trace or span.

### Use a simple configuration

1. Select the target data source from the drop-down list.
1. Set **Span start time shift** and **Span end time shift** to widen or shift the time range if log timestamps don't exactly match span timestamps.
1. Configure **Tags** to use in the logs query. Tags must be present in span attributes or resources for the link to appear. You can remap tag names if the target data source doesn't allow dots in labels (for example, remap `http.status` to `http_status`).
1. Optionally, toggle on **Filter by trace ID** or **Filter by span ID** to further filter logs.

### Configure a custom query

1. Select the target data source from the drop-down list.
1. Set **Span start time shift** and **Span end time shift**.
1. Optionally, configure **Tags** to map. Use the `${__tags}` variable in your custom query to interpolate mapped tags. If you don't map tags, you can still reference any span tag directly, such as `method="${__span.tags.method}"`.
1. Toggle on **Use custom query**.
1. Write a custom query using the variables listed in this table. The link only appears when all variables resolve to non-empty values.

### Variables for custom queries

To use a variable, wrap it in `${}`. For example: `${__span.name}`.

| Variable               | Description                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **\_\_tags**           | Interpolates mapped tags as a label matcher string in the target data source syntax. Only includes tags present in the span.           |
| **\_\_span.spanId**    | The ID of the span.                                                                                                                    |
| **\_\_span.traceId**   | The ID of the trace.                                                                                                                   |
| **\_\_span.duration**  | The duration of the span.                                                                                                              |
| **\_\_span.name**      | The name of the span.                                                                                                                  |
| **\_\_span.tags**      | Namespace for span tags. Access a specific tag with `${__span.tags.version}`. For tags with dots, use `${__span.tags["http.status"]}`. |
| **\_\_trace.traceId**  | The ID of the trace.                                                                                                                   |
| **\_\_trace.duration** | The duration of the trace.                                                                                                             |
| **\_\_trace.name**     | The name of the trace.                                                                                                                 |

### Trace to logs settings

| Setting                   | Description                                                                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data source**           | The target logs data source. You can select Loki or Splunk logs data sources.                                                                                              |
| **Span start time shift** | Shifts the start time for the logs query based on the span's start time. Use time units such as `5s`, `1m`, `3h`. Use negative values to extend to the past. Default: `0`. |
| **Span end time shift**   | Shifts the end time for the logs query based on the span's end time. Default: `0`.                                                                                         |
| **Tags**                  | Tags to use in the logs query. Default: `cluster`, `hostname`, `namespace`, `pod`, `service.name`, `service.namespace`.                                                    |
| **Filter by trace ID**    | Toggles whether to append the trace ID to the logs query.                                                                                                                  |
| **Filter by span ID**     | Toggles whether to append the span ID to the logs query.                                                                                                                   |
| **Use custom query**      | Toggles the use of a custom query with variable interpolation.                                                                                                             |
| **Query**                 | The custom query. Use variable interpolation to customize with values from the span.                                                                                       |

## Trace to metrics

The **Trace to metrics** setting lets you link trace spans to related metrics queries.

To configure trace to metrics:

1. Select the target metrics data source from the drop-down list.
1. Configure **Tags** to map span attributes to metric label names. For example, map `k8s.pod` to `pod`.
1. Create linked queries using the `$__tags` keyword to interpolate the mapped tags.

| Setting         | Description                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data source** | The target metrics data source.                                                                                                                 |
| **Tags**        | Maps span attribute names to metric label names. For example, map `k8s.pod` to `pod`. Use the `$__tags` keyword to interpolate tags in queries. |

Each linked query consists of:

- **Link Label:** _(Optional)_ A descriptive label for the linked query.
- **Query:** The query to run when navigating from a trace to the metrics data source. Use `$__tags` to interpolate tags. For example, the query `requests_total{$__tags}` with tags `k8s.pod=pod` and `cluster` produces `requests_total{pod="nginx-554b9", cluster="us-east-1"}`.

## Node graph

The **Node graph** setting is located under **Additional settings**, which is collapsed by default. Expand the **Additional settings** section on the data source configuration page to access it.

The **Node graph** setting enables the [Node Graph visualization](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/node-graph/), which is disabled by default.

When enabled, Grafana displays the Node Graph above the trace view, showing the relationships between services in the trace.

## Span bar

The **Span bar** setting is located under **Additional settings**, which is collapsed by default. Expand the **Additional settings** section on the data source configuration page to access it.

The **Span bar** setting controls what additional information appears in the span bar row of the trace view.

| Option       | Description                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------- |
| **None**     | Adds nothing to the span bar row.                                                               |
| **Duration** | _(Default)_ Displays the span duration on the span bar row.                                     |
| **Tag**      | Displays a span tag value on the span bar row. Specify the tag key to use, such as `component`. |

## Trace ID time parameters

The **Query Trace by ID with Time Params** setting is located under **Additional settings**, which is collapsed by default. Expand the **Additional settings** section on the data source configuration page to access it.

The **Enable Time Parameters** toggle controls whether Grafana sends `start` and `end` time parameters when querying a trace by ID. Enable this if your Jaeger instance benefits from time-bounded trace lookups.

## Verify the connection

Click **Save & test** to verify the data source connection. A successful test displays the message **Data source is working**.

If the test fails, refer to [Troubleshoot Jaeger data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/jaeger/troubleshooting/) for help resolving common errors.

## Provision the data source

You can define and configure the data source in YAML files as part of the Grafana provisioning system. For more information about provisioning, refer to [Provisioning Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources).

### Provisioning example

```yaml
apiVersion: 1

datasources:
  - name: Jaeger
    type: jaeger
    uid: jaeger-ds
    url: http://localhost:16686
    access: proxy
    basicAuth: true
    basicAuthUser: <USERNAME>
    isDefault: false
    jsonData:
      tracesToLogsV2:
        datasourceUid: 'loki'
        spanStartTimeShift: '1h'
        spanEndTimeShift: '-1h'
        tags:
          - key: 'job'
          - key: 'instance'
          - key: 'pod'
          - key: 'namespace'
        filterByTraceID: false
        filterBySpanID: false
        customQuery: true
        query: 'method="$${__span.tags.method}"'
      tracesToMetrics:
        datasourceUid: 'prom'
        spanStartTimeShift: '-2m'
        spanEndTimeShift: '2m'
        tags:
          - key: 'service.name'
            value: 'service'
          - key: 'job'
        queries:
          - name: 'Sample query'
            query: 'sum(rate(traces_spanmetrics_latency_bucket{$$__tags}[5m]))'
      nodeGraph:
        enabled: true
      traceIdTimeParams:
        enabled: true
      spanBar:
        type: 'Duration'
    secureJsonData:
      basicAuthPassword: <PASSWORD>
```

Replace `<USERNAME>` and `<PASSWORD>` with your Jaeger credentials.

## Provision with Terraform

You can provision the Jaeger data source using [Terraform](https://www.terraform.io/) with the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

For more information about provisioning resources with Terraform, refer to the [Grafana as code using Terraform](https://grafana.com/docs/grafana-cloud/developer-resources/infrastructure-as-code/terraform/) documentation.

### Terraform example

The following example provisions a Jaeger data source:

```hcl
terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = ">= 2.0.0"
    }
  }
}

provider "grafana" {
  url  = "<YOUR_GRAFANA_URL>"
  auth = "<YOUR_SERVICE_ACCOUNT_TOKEN>"
}

resource "grafana_data_source" "jaeger" {
  type = "jaeger"
  name = "Jaeger"
  url  = "http://localhost:16686"

  json_data_encoded = jsonencode({
    nodeGraph = {
      enabled = true
    }
    traceIdTimeParams = {
      enabled = true
    }
    tracesToLogsV2 = {
      datasourceUid    = "loki"
      filterByTraceID  = true
      filterBySpanID   = false
      tags = [
        { key = "service.name", value = "service" },
        { key = "job" }
      ]
    }
  })
}
```

### Terraform example with basic authentication

The following example provisions a Jaeger data source with basic authentication:

```hcl
resource "grafana_data_source" "jaeger_auth" {
  type                = "jaeger"
  name                = "Jaeger"
  url                 = "http://localhost:16686"
  basic_auth_enabled  = true
  basic_auth_username = "<USERNAME>"

  json_data_encoded = jsonencode({
    nodeGraph = {
      enabled = true
    }
    traceIdTimeParams = {
      enabled = true
    }
  })

  secure_json_data_encoded = jsonencode({
    basicAuthPassword = "<PASSWORD>"
  })
}
```

Replace the following placeholders:

- _`<YOUR_GRAFANA_URL>`_: Your Grafana instance URL (for example, `https://your-org.grafana.net` for Grafana Cloud)
- _`<YOUR_SERVICE_ACCOUNT_TOKEN>`_: A service account token with data source permissions
- _`<USERNAME>`_: The username for basic authentication
- _`<PASSWORD>`_: The password for basic authentication

For all available configuration options, refer to the [Grafana provider data source resource documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source).
