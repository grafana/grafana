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
review_date: 2026-05-07
---

# Configure the Prometheus data source

This document provides instructions for configuring the Prometheus data source and explains the available configuration options. Grafana includes built-in support for Prometheus, so you don't need to install a plugin. For general information on adding a data source to Grafana, refer to [Add a data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/#add-a-data-source).

## Before you begin

- You need the `Organization administrator` role to configure the data source. You can also [configure it via YAML](#provision-the-data-source) using Grafana provisioning or [using Terraform](#terraform).

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

Grafana takes you to the **Settings** tab where you set up your Prometheus configuration.

## Configuration options

The following sections describe the configuration options available on the Settings tab. These sections follow the order in which they appear in the UI.

### Name and default

- **Name** - The data source name. Sets the name you use to refer to the data source in panels and queries. Examples: `prometheus-1`, `prom-metrics`.
- **Default** - Toggle to select as the default data source in dashboard panels.

### Connection

- **Prometheus server URL** - The URL of your Prometheus server. {{< shared id="prom-data-source-url" >}}
  If Prometheus is running locally, use `http://localhost:9090`. If it's hosted on a networked server, provide the server's URL along with the port where Prometheus is running. Example: `http://prometheus.example.orgname:9090`.

{{< admonition type="note" >}}
When running Grafana and Prometheus in separate containers, localhost refers to each container's own network namespace. This means that `localhost:9090` points to port 9090 inside the Grafana container, not on the host machine.

Use the IP address of the Prometheus container, or the hostname if you are using Docker Compose. Alternatively, you can use `http://host.docker.internal:9090` to reference the host machine.
{{< /admonition >}}

{{< /shared >}}

### Authentication

There are three authentication options for the Prometheus data source.

- **Basic authentication** - The most common authentication method.
  - **User** - The username you use to connect to the data source.
  - **Password** - The password you use to connect to the data source.

- **Forward OAuth identity** - Forward the OAuth access token (and also the OIDC ID token if available) of the user querying the data source.

- **No authentication** - Allows access to the data source without any authentication.

Additional authentication methods (Azure AD, AWS SigV4) are available depending on your deployment:

{{< admonition type="warning" >}}
Azure AD and SigV4 authentication on the core Prometheus data source are **deprecated** in Grafana 13. Existing data sources using these methods are automatically migrated to dedicated plugins on startup. For new setups, use the [Azure Monitor Managed Service for Prometheus](https://grafana.com/grafana/plugins/grafana-azureprometheus-datasource/) or [Amazon Managed Service for Prometheus](https://grafana.com/grafana/plugins/grafana-amazonprometheus-datasource/) plugins instead. For migration details, refer to [Azure authentication (deprecated)](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/configure/azure-authentication/) or [AWS authentication (deprecated)](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/configure/aws-authentication/).
{{< /admonition >}}

- **Azure AD authentication** - Available in Grafana Enterprise and self-managed instances where `azure_auth_enabled = true` is configured. On Grafana Cloud, this option requires a server-side feature flag that isn't enabled by default — contact [Grafana Support](https://grafana.com/profile/org#support) to request it be enabled for your stack. Refer to [Azure authentication settings](#azure-authentication-settings-deprecated) for configuration details.

- **AWS SigV4 authentication** - Available in self-managed Grafana instances where `sigv4_auth_enabled = true` is configured. On Grafana Cloud, this option isn't available by default — contact [Grafana Support](https://grafana.com/profile/org#support) to request it be enabled for your stack.

{{< admonition type="note" >}}
If Azure AD or SigV4 options don't appear in the authentication drop-down, the required feature flag isn't enabled on your instance. For Grafana Cloud, submit a support request. For self-managed instances, update the Grafana configuration file.
{{< /admonition >}}

### TLS settings

{{< admonition type="note" >}}
Use TLS (Transport Layer Security) for an additional layer of security when working with Prometheus. For information on setting up TLS encryption with Prometheus refer to [Securing Prometheus API and UI Endpoints Using TLS Encryption](https://prometheus.io/docs/guides/tls-encryption/). You must add TLS settings to your Prometheus configuration file **prior** to setting these options in Grafana.
{{< /admonition >}}

- **Add self-signed certificate** - Check the box to authenticate with a CA certificate. Follow the instructions of the CA (Certificate Authority) to download the certificate file. Required for verifying self-signed TLS certificates.
  - **CA certificate** - Add your certificate.
- **TLS client authentication** - Check the box to enable TLS client authentication.
  - **Server name** - Add the server name, which is used to verify the hostname on the returned certificate.
  - **Client certificate** - The client certificate is generated from a Certificate Authority or is self-signed. Follow the instructions of the CA to download the certificate file.
  - **Client key** - Add your client key, which can also be generated from a CA or be self-signed. The client key encrypts data between the client and server.
- **Skip TLS verify** - Toggle on to bypass TLS certificate validation. Skipping TLS certificate validation is not recommended unless absolutely necessary or for testing purposes.

### HTTP headers

Pass along additional information and metadata about the request or response.

- **Header** - Add a custom header. This allows custom headers to be passed based on the needs of your Prometheus instance.
- **Value** - The value of the header.

### Advanced HTTP settings

- **Allowed cookies** - Specify cookies by name that should be forwarded to the data source. The Grafana proxy deletes all forwarded cookies by default.
- **Timeout** - The HTTP request timeout in seconds.

### Alerting

- **Manage alerts via Alerting UI** - Toggled on by default. This enables [data source-managed rules in Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/) for this data source. For `Mimir`, it enables managing data source-managed rules and alerts. For `Prometheus`, it only supports viewing existing rules and alerts, which are displayed as data source-managed. Change this by setting the [`default_manage_alerts_ui_toggle`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#default_manage_alerts_ui_toggle) option in the `grafana.ini` configuration file.

- **Allow as recording rules target** - Toggled on by default. This allows the data source to be selected as a target destination for writing [Grafana-managed recording rules](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/). When enabled, this data source appears in the target data source list when creating or importing recording rules. Change this by setting the [`default_allow_recording_rules_target_alerts_ui_toggle`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#default_allow_recording_rules_target_alerts_ui_toggle) option in the `grafana.ini` configuration file.

### Interval behavior

- **Scrape interval** - Sets the standard scrape and evaluation interval in Prometheus. The default is `15s`. Set it to match the typical scrape and evaluation interval in your Prometheus configuration file. If you set a higher value than your Prometheus configuration, Grafana evaluates data at this interval, resulting in less data points.
- **Query timeout** - Sets the Prometheus query timeout. The default is `60s`. Without a timeout, complex or inefficient queries can run indefinitely, consuming CPU and memory resources.

### Query editor

- **Default editor** - Sets the default query editor. Options are `Builder` or `Code`. `Builder` mode helps you build queries using a visual interface. `Code` mode is geared for the experienced Prometheus user with prior expertise in PromQL. For more details on editor types, refer to [Prometheus query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/query-editor). You can switch between editors in the query editor UI.
- **Disable metrics lookup** - Toggle on to disable the metrics chooser and metric and label support in the query field's autocomplete. This can improve performance for large Prometheus instances.

### Performance

- **Prometheus type** - Select the type of your Prometheus-compatible database. Setting this incorrectly may cause unexpected behavior when querying metrics and labels. Cortex is end-of-life; if you're running Cortex, consider migrating to [Mimir](https://grafana.com/oss/mimir/).

  | Capability | Prometheus | Mimir | Thanos | Cortex |
  | --- | --- | --- | --- | --- |
  | Regex label matching in variable queries | No | Yes | No | Yes |
  | Metadata API (metric type/help) | Yes (2.4+) | Yes | No | Yes |
  | Exemplars | Yes (2.26+) | Yes | No | No |
  | Data source-managed alert rules (read/write) | Read only | Read/Write | Read only | Read/Write |
  | Recording rules target (write-back) | Yes | Yes | No | Yes |
  | LBAC (Team-based access control) | No | Yes (Cloud/GEM) | No | No |
  | Native histograms | Yes (2.40+) | Yes | No | No |

  Grafana uses this setting to determine which API endpoints and features to enable. For example, when set to Mimir, Grafana uses regex-optimized label queries that significantly improve autocomplete and variable loading performance for large metric sets.

{{< admonition type="note" >}}
Team-based Label-Based Access Control (LBAC) for the Prometheus data source requires the backend to be **Grafana Cloud Metrics (Mimir)** or **Grafana Enterprise Metrics (GEM)**. LBAC doesn't work with external Prometheus-compatible endpoints such as Google Managed Prometheus, self-hosted Prometheus, or Thanos, even if you enable the `teamHttpHeadersMimir` setting. The LBAC enforcement relies on Mimir-specific HTTP headers that other backends don't support.
{{< /admonition >}}

- **Cache level** - Sets the browser caching level for editor queries. Options: `Low`, `Medium`, `High`, or `None`. Higher cache settings are recommended for high-cardinality data sources.
- **Incremental querying (beta)** - Toggle on to enable incremental querying. Instead of always requesting fresh data from the Prometheus instance, Grafana caches query results and only fetches new records. This helps reduce database and network load.
  - **Query overlap window** - Specify a duration (for example, `10m`, `120s`, or `0s`). The default is `10m`. This buffer is added to each incremental request to account for delayed data ingestion.
- **Disable recording rules (beta)** - Toggle on to disable recording rules. When disabled, Grafana won't fetch and parse recording rules from Prometheus, improving dashboard performance by reducing processing overhead.

### Other

- **Custom query parameters** - Add custom parameters to the Prometheus query URL for more control over query execution. Examples: `timeout`, `partial_response`, `dedup`, or `max_source_resolution`. Join multiple parameters with `&`.
- **HTTP method** - Select either the `POST` or `GET` HTTP method to query your data source. `POST` is recommended and selected by default, as it supports larger queries. Select `GET` if your network restricts `POST` requests.
- **Series limit** - Maximum number of returned series. The limit applies to all resources (metrics, labels, and values) for both endpoints (series and labels). Leave empty to use the default limit (40000). Set to `0` to disable the limit — this may cause performance issues.
- **Use series endpoint** - Toggle on to use the series endpoint (`/api/v1/series`) with the `match[]` parameter instead of the label values endpoint (`/api/v1/label/<label_name>/values`). The label values endpoint is generally more performant, but the series endpoint supports the `POST` method.

### Exemplars

Support for exemplars is available only for the Prometheus data source. An exemplar is a trace that represents a specific measurement taken within a given time interval. For more information, refer to [Introduction to exemplars](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/).

Click the **+ sign** to add exemplars.

- **Internal link** - Toggle on to enable an internal link. This displays the data source selector, where you can choose the backend tracing data store for your exemplar data.
- **URL** - _(Visible if you disable `Internal link`)_ Defines the external link's URL trace backend. You can interpolate the value from the field by using the [`${__value.raw}` macro](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-data-links/#value-variables).
- **Data source** - _(Visible when `Internal link` is enabled)_ Select the tracing data source that the exemplar links to.
- **URL label** - Adds a custom display label to override the value of the `Label name` field.
- **Label name** - The name of the field in the `labels` object used to obtain the traceID property.
- **Remove exemplar link** - Click the **X** to remove existing links.

You can add multiple exemplar configurations.

### Private data source connect

{{< admonition type="note" >}}
Private data source connect (PDC) is only available for Grafana Cloud users.
{{< /admonition >}}

PDC allows you to establish a private, secured connection between a Grafana Cloud instance and data sources within a private network without opening the network to inbound traffic.

- **Private data source connect network** - Select the PDC network where your data source is available.

PDC supports both querying and writing to Prometheus-compatible data sources. This means [Grafana-managed recording rules](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/) can write their results to a Prometheus or Mimir instance behind a PDC connection.

If you use PDC with SigV4 (AWS Signature Version 4 Authentication), the PDC agent must allow internet egress to `sts.<region>.amazonaws.com:443`.

Click **Manage private data source connect networks** to view your PDC configuration details.

For more information, refer to [Private data source connect (PDC)](/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) and [Configure PDC](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc).

For troubleshooting PDC connectivity issues (DNS resolution, "host unreachable" errors, or parallel connection tuning), refer to [PDC connectivity errors](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/troubleshooting/#pdc-connectivity-errors).

## Save and test

After you have configured your Prometheus data source options, click **Save & test** at the bottom to test your data source connection.

You should see a confirmation message:

**Successfully queried the Prometheus API.**

You can also remove a connection by clicking **Delete**.

## Provision the data source

You can define and configure the data source in YAML files as part of the Grafana provisioning system, or use Terraform with the Grafana provider.

{{< admonition type="note" >}}
After you have provisioned a data source, you cannot edit it through the UI.
{{< /admonition >}}

### Provision with YAML 

For more information about provisioning, and for available configuration options, refer to [Provision Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/).

**Example Prometheus data source configuration:**

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
      prometheusVersion: 3.3.0
      cacheLevel: 'High'
      disableRecordingRules: false
      seriesEndpoint: false
      timeInterval: 10s
      incrementalQueryOverlapWindow: 10m
      exemplarTraceIdDestinations:
        - datasourceUid: my_jaeger_uid
          name: traceID
        - name: traceID
          url: 'http://localhost:3000/explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22Jaeger%22,%7B%22query%22:%22$${__value.raw}%22%7D%5D'
```

### Provision with Terraform

You can configure the Prometheus data source using [Terraform](https://www.terraform.io/) with the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

For more information about provisioning resources with Terraform, refer to [Grafana as code using Terraform](https://grafana.com/docs/grafana-cloud/developer-resources/infrastructure-as-code/terraform/).

The following example creates a Prometheus data source with common settings:

```hcl
resource "grafana_data_source" "prometheus" {
  name = "Prometheus"
  type = "prometheus"
  url  = "http://localhost:9090"

  json_data_encoded = jsonencode({
    httpMethod                    = "POST"
    manageAlerts                  = true
    prometheusType                = "Prometheus"
    prometheusVersion             = "3.3.0"
    cacheLevel                    = "High"
    disableRecordingRules         = false
    incrementalQuerying           = true
    incrementalQueryOverlapWindow = "10m"
    timeInterval                  = "15s"
    exemplarTraceIdDestinations = [{
      datasourceUid = "my_tempo_uid"
      name          = "traceID"
    }]
  })
}
```

The following example creates a Prometheus data source with basic authentication:

```hcl
resource "grafana_data_source" "prometheus_auth" {
  name = "Prometheus (authenticated)"
  type = "prometheus"
  url  = "https://prometheus.example.com:9090"

  basic_auth_enabled  = true
  basic_auth_username = "grafana"

  json_data_encoded = jsonencode({
    httpMethod     = "POST"
    prometheusType = "Mimir"
    timeInterval   = "15s"
  })

  secure_json_data_encoded = jsonencode({
    basicAuthPassword = var.prometheus_password
  })
}
```

For all available configuration options, refer to the [Grafana provider data source resource documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source).

## Azure authentication settings (deprecated)

{{< admonition type="warning" >}}
Azure AD authentication on the core Prometheus data source is **deprecated** in Grafana 13. Data sources using this method are automatically migrated to the dedicated [Azure Monitor Managed Service for Prometheus](https://grafana.com/grafana/plugins/grafana-azureprometheus-datasource/) plugin on startup. For migration details, refer to [Azure authentication (deprecated)](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/configure/azure-authentication/).
{{< /admonition >}}

If you still need to configure Azure AD authentication on the core Prometheus data source (for example, on older Grafana versions), refer to [Configure Azure Active Directory (AD) authentication](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/#configure-azure-active-directory-ad-authentication).

In Grafana Enterprise or self-managed OSS, update the `.ini` configuration file. Refer to [Configuration file location](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#configuration-file-location) to locate your `.ini` file.

Add the following setting in the **[auth]** section:

```bash
[auth]
azure_auth_enabled = true
```

{{< admonition type="note" >}}
If you are using Azure authentication, don't enable `Forward OAuth identity`. Both methods use the same HTTP authorization headers, and the OAuth token will override your Azure credentials.
{{< /admonition >}}

## Troubleshooting

If you encounter issues after configuring your Prometheus data source, refer to [Troubleshoot Prometheus data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/troubleshooting/).
