---
aliases:
  - ../data-sources/prometheus/
  - ../features/datasources/prometheus/
description: Guide for configuring Prometheus in Grafana
keywords:
  - grafana
  - prometheus
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure
title: Configure the Prometheus data source
weight: 200
review_date: 2026-03-10
---

# Configure the Prometheus data source

This document provides instructions for configuring the Prometheus data source and explains the available configuration options. Grafana includes built-in support for Prometheus, so you don't need to install a plugin. For general information on adding a data source to Grafana, refer to [Add a data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/#add-a-data-source).

## Before you begin

- You need the `Organization administrator` role to configure the data source. You can also [configure it via YAML](#provision-the-data-source) using Grafana provisioning.

- Grafana includes a built-in Prometheus data source; no plugin installation is required.

- Know which type of Prometheus-compatible database you're connecting to (Prometheus, Mimir, Cortex, or Thanos), as the configuration options vary by type.

- Have your Prometheus server URL ready. If using TLS/SSL, gather any necessary security certificates and client keys.

- If using Basic authentication, have your username and password ready.

## Add the data source

{{< shared id="add-prom-data-source" >}}

To add the Prometheus data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Under **Connections**, click **Add new connection**.
1. Enter `Prometheus` in the search bar.
1. Click **Prometheus data source**.
1. Click **Add new data source** in the upper right.

{{< /shared >}}

You are taken to the **Settings** tab where you will set up your Prometheus configuration.

## Configuration options

Configure the following basic settings for the Prometheus data source:

- **Name** - The data source name. Sets the name you use to refer to the data source in panels and queries. Examples: prometheus-1, prom-metrics.
- **Default** - Toggle to make this the default data source. New panels and Explore queries use the default data source.

## Connection

- **Prometheus server URL** - The URL of your Prometheus server. {{< shared id="prom-data-source-url" >}}
  If Prometheus is running locally, use `http://localhost:9090`. If it's hosted on a networked server, provide the server's URL along with the port where Prometheus is running. Example: `http://prometheus.example.orgname:9090`.

{{< admonition type="note" >}}
When running Grafana and Prometheus in separate containers, localhost refers to each container's own network namespace. This means that `localhost:9090` points to port 9090 inside the Grafana container, not on the host machine.

Use the IP address of the Prometheus container, or the hostname if you are using Docker Compose. Alternatively, you can use `http://host.docker.internal:9090` to reference the host machine.
{{< /admonition >}}

{{< /shared >}}

## Authentication

Select an authentication method from the drop-down menu:

- **Basic authentication** - The most common authentication method.
  - **User** - The username you use to connect to the data source.
  - **Password** - The password you use to connect to the data source.

- **Forward OAuth identity** - Forward the OAuth access token (and also the OIDC ID token if available) of the user querying the data source.

- **No authentication** - Connect without credentials. Only use this option if your Prometheus instance doesn't require authentication.

For Azure or AWS authentication, refer to [Connect to Azure Monitor Managed Service for Prometheus](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/azure-authentication/) or [Connect to Amazon Managed Service for Prometheus](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/aws-authentication/).

{{< admonition type="note" >}}
If you are using Azure authentication, don't enable `Forward OAuth identity`. Both methods use the same HTTP authorization headers, and the OAuth token will override your Azure credentials.
{{< /admonition >}}

### TLS settings

{{< admonition type="note" >}}
Use TLS (Transport Layer Security) for an additional layer of security when working with Prometheus. For information on setting up TLS encryption with Prometheus refer to [Securing Prometheus API and UI Endpoints Using TLS Encryption](https://prometheus.io/docs/guides/tls-encryption/). You must add TLS settings to your Prometheus configuration file **prior** to setting these options in Grafana.
{{< /admonition >}}

- **Add self-signed certificate** - Check the box to authenticate with a CA certificate. Follow the instructions of the CA (Certificate Authority) to download the certificate file. Required for verifying self-signed TLS certificates.
  - **CA certificate** - Add your certificate.
- **TLS client authentication** - Check the box to enable TLS client authentication.
  - **Server name** - Add the server name, which is used to verify the hostname on the returned certificate.
  - **Client certificate** - The client certificate is generated from a Certificate Authority or its self-signed. Follow the instructions of the CA (Certificate Authority) to download the certificate file.
  - **Client key** - Add your client key, which can also be generated from a Certificate Authority (CA) or be self-signed. The client key encrypts data between the client and server.
- **Skip TLS verify** - Toggle on to bypass TLS certificate validation. Skipping TLS certificate validation is not recommended unless absolutely necessary or for testing purposes.

### HTTP headers

Click **+ Add header** to add one or more HTTP headers. HTTP headers pass additional context and metadata about the request or response.

- **Header** - Add a custom header. This allows custom headers to be passed based on the needs of your Prometheus instance.
- **Value** - The value of the header.

## Additional settings

Additional settings are optional settings that can be configured for more control over your data source. These appear under the collapsed **Advanced settings** section in the UI.

### Advanced HTTP settings

- **Allowed cookies** - Specify cookies by name that should be forwarded to the data source. The Grafana proxy deletes all forwarded cookies by default.
- **Timeout** - The HTTP request timeout, must be in seconds.

### Alerting

- **Manage alerts via Alerting UI** - Toggled on by default. This enables [data source-managed rules in Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/) for this data source. For `Mimir`, it enables managing data source-managed rules and alerts. For `Prometheus`, it only supports viewing existing rules and alerts, which are displayed as data source-managed. Change this by setting the [`default_manage_alerts_ui_toggle`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#default_manage_alerts_ui_toggle) option in the `grafana.ini` configuration file.

- **Allow as recording rules target** - Toggled on by default. This allows the data source to be selected as a target destination for writing [Grafana-managed recording rules](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/). When enabled, this data source will appear in the target data source list when creating or importing recording rules. When disabled, the data source will be filtered out from recording rules target selection. Change this by setting the [`default_allow_recording_rules_target_alerts_ui_toggle`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#default_allow_recording_rules_target_alerts_ui_toggle) option in the `grafana.ini` configuration file.

### Interval behavior

- **Scrape interval** - Sets the standard scrape and evaluation interval in Prometheus. The default is `15s`. This interval determines how often Prometheus scrapes targets. Set it to match the typical scrape and evaluation interval in your Prometheus configuration file. If you set a higher value than your Prometheus configuration, Grafana will evaluate data at this interval, resulting in fewer data points.
- **Query timeout** - Sets the Prometheus query timeout. The default is `60s`. Without a timeout, complex or inefficient queries can run indefinitely, consuming CPU and memory resources.

### Query editor

- **Default editor** - Sets the default query editor for all users of this data source. Options are `Builder` or `Code`. `Builder` mode helps you build queries using a visual interface. `Code` mode is geared for experienced Prometheus users with prior expertise in PromQL. For more details on editor types, refer to [Prometheus query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/query-editor/). You can switch between editors in the query editor.
- **Disable metrics lookup** - Toggle on to disable the metrics chooser and metric and label support in the query field's autocomplete. This can improve performance for large Prometheus instances.

### Performance

- **Prometheus type** - Select the type of your Prometheus-compatible database, such as Prometheus, Cortex, Mimir, or Thanos. Changing this setting saves your current configuration. Different database types support different APIs. For example, some allow `regex` matching for label queries to improve performance, while others provide a metadata API. Setting this incorrectly may cause unexpected behavior when querying metrics and labels. Refer to your Prometheus documentation to ensure you select the correct type.
- **{Prometheus type} version** - _(Visible after selecting a Prometheus type.)_ Select the version of your Prometheus-compatible database. Grafana attempts to detect the version automatically, but you can set it manually if needed. The available version options depend on the selected Prometheus type.
- **Cache level** - Sets the browser caching level for editor queries. There are four options: `Low`, `Medium`, `High`, or `None`. Higher cache settings are recommended for high cardinality data sources.
- **Incremental querying (beta)** - Toggle on to enable incremental querying. Enabling this feature changes the default behavior of relative queries. Instead of always requesting fresh data from the Prometheus instance, Grafana will cache query results and only fetch new records. This helps reduce database and network load.
  - **Query overlap window** - If you are using incremental querying, specify a duration (e.g., 10m, 120s, or 0s). The default is `10m`. This is a buffer of time added to incremental queries and this value is added to the duration of each incremental request.
- **Disable recording rules (beta)** - Toggle on to disable the recording rules. When recording rules are disabled, Grafana won't fetch and parse recording rules from Prometheus, improving dashboard performance by reducing processing overhead. You can also set `disableRecordingRules` in `jsonData` when [provisioning](#provision-the-data-source).

### Other

- **Custom query parameters** - Add custom parameters to the Prometheus query URL, which allow for more control over how queries are executed. Examples: `timeout`, `partial_response`, `dedup`, or `max_source_resolution`. Multiple parameters should be joined using `&`.
- **HTTP method** - Select either the `POST` or `GET` HTTP method to query your data source. `POST` is recommended and selected by default, as it supports larger queries. Select `GET` if you're using Prometheus version 2.1 or older, or if your network restricts `POST` requests.
- **Series limit** - The maximum number of returned series. The limit applies to all resources (metrics, labels, and values) for both endpoints (series and labels). Leave the field empty to use the default limit (40000). Set to 0 to disable the limit and fetch everything — this may cause performance issues.
- **Use series endpoint** - Enabling this option makes Grafana use the series endpoint (/api/v1/series) with the match[] parameter instead of the label values endpoint (/api/v1/label/<label_name>/values). While the label values endpoint is generally more performant, some users may prefer the series endpoint because it supports the `POST` method, whereas the label values endpoint only allows `GET` requests.

### Exemplars

Support for exemplars is available only for the Prometheus data source. For more information on exemplars refer to [Introduction to exemplars](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/). An exemplar is a trace that represents a specific measurement taken within a given time interval.

Click **Add** to add an exemplar link.

- **Internal link** - Toggle on to enable an internal link. When enabled, this displays the data source selector where you can choose the backend tracing data store for your exemplar data.
- **URL** - _(Visible when `Internal link` is disabled.)_ Defines the external link URL for the trace backend. You can interpolate the value from the field by using the [`${__value.raw}` macro](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-data-links/#value-variables).
- **Data source** - _(Visible when `Internal link` is enabled.)_ Select the backend tracing data source that the exemplar will navigate to.
- **URL Label** - Adds a custom display label to override the button label on the exemplar traceID field.
- **Label name** - The name of the field in the `labels` object used to obtain the traceID property.
- **Remove exemplar link** - Click the remove button to delete an existing exemplar link.

You can add multiple exemplar links.

## Private data source connect

_Only for Grafana Cloud users._

Private data source connect, or PDC, allows you to establish a private, secured connection between a Grafana Cloud instance, or stack, and data sources secured within a private network. Click the drop-down to locate the URL for PDC. For more information regarding Grafana PDC refer to [Private data source connect (PDC)](/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) and [Configure Grafana private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc) for steps on setting up a PDC connection.

PDC supports both querying and writing to Prometheus-compatible data sources. This means [Grafana-managed recording rules](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/) can write their results to a Prometheus or Mimir instance behind a PDC connection.

If you use PDC with SIGv4 (AWS Signature Version 4 Authentication), the PDC agent must allow internet egress to `sts.<region>.amazonaws.com:443`.

Click **Manage private data source connect** to open your PDC connection page and view your configuration details.

## Save and test

After you have configured your Prometheus data source options, click **Save & test** at the bottom to test the connection. A successful connection displays the following message:

**Successfully queried the Prometheus API.**

**Next, you can start to visualize data by building a dashboard, or by querying data in the Explore view.**

You can also remove a connection by clicking **Delete**.

If the connection test fails, refer to [Troubleshoot Prometheus data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/troubleshooting/) for help resolving common errors.

## Provision the data source

You can define and configure the data source in YAML files as part of the Grafana provisioning system. For more information about provisioning, and for available configuration options, refer to [Provision Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/).

{{< admonition type="note" >}}
After you have provisioned a data source you cannot edit it.
{{< /admonition >}}

**Example of a Prometheus data source configuration:**

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://localhost:9090
    jsonData:
      httpMethod: POST
      manageAlerts: true
      allowAsRecordingRulesTarget: true
      prometheusType: Prometheus
      prometheusVersion: 2.50.0
      cacheLevel: 'High'
      disableRecordingRules: false
      seriesEndpoint: false
      timeInterval: 10s # Prometheus scrape interval
      incrementalQuerying: true
      incrementalQueryOverlapWindow: 10m
      exemplarTraceIdDestinations:
        # Field with internal link pointing to data source in Grafana.
        # datasourceUid value can be anything, but it should be unique across all defined data source uids.
        - datasourceUid: my_jaeger_uid
          name: traceID

        # Field with external link.
        - name: traceID
          url: 'http://localhost:3000/explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22Jaeger%22,%7B%22query%22:%22$${__value.raw}%22%7D%5D'
```

## Provision the data source using Terraform

You can provision the Prometheus data source using [Terraform](https://www.terraform.io/) with the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

For more information about provisioning resources with Terraform, refer to the [Grafana as code using Terraform](https://grafana.com/docs/grafana-cloud/developer-resources/infrastructure-as-code/terraform/) documentation.

### Terraform example

The following example creates a basic Prometheus data source:

```hcl
resource "grafana_data_source" "prometheus" {
  name = "Prometheus"
  type = "prometheus"
  url  = "http://localhost:9090"

  json_data_encoded = jsonencode({
    httpMethod                   = "POST"
    prometheusType               = "Prometheus"
    prometheusVersion            = "2.50.0"
    cacheLevel                   = "High"
    timeInterval                 = "15s"
    incrementalQuerying          = true
    incrementalQueryOverlapWindow = "10m"
    manageAlerts                 = true
    allowAsRecordingRulesTarget  = true
  })
}
```

### Terraform example with exemplars

The following example includes an exemplar link to a Jaeger data source:

```hcl
resource "grafana_data_source" "prometheus_exemplars" {
  name = "Prometheus"
  type = "prometheus"
  url  = "http://localhost:9090"

  json_data_encoded = jsonencode({
    httpMethod     = "POST"
    prometheusType = "Prometheus"
    timeInterval   = "15s"
    exemplarTraceIdDestinations = [
      {
        datasourceUid = grafana_data_source.jaeger.uid
        name          = "traceID"
      }
    ]
  })
}
```

For all available configuration options, refer to the [Grafana provider data source resource documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source).

## Next steps

After configuring your Prometheus data source, you can:

- [Write queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/query-editor/) using the query editor to explore and visualize your data.
- [Use template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/template-variables/) to create dynamic, reusable dashboards.
- [Add annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/annotations/) to overlay Prometheus events on your graphs.
- [Set up alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/alerting/) to create alert rules based on your Prometheus data.
- [Troubleshoot issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/troubleshooting/) if you encounter problems with your data source.
