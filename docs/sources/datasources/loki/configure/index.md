---
aliases:
  - ../data-sources/loki/
  - ../features/datasources/loki/
  - ../configure-loki-data-source/
description: Configure the Loki data source
keywords:
  - grafana
  - loki
  - logging
  - guide
  - data source
menuTitle: Configure
title: Configure the Loki data source
weight: 200
refs:
  log-details:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/logs-integration/#labels-and-detected-fields
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/logs-integration/#labels-and-detected-fields
  alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/
  private-data-source-connect:
    - pattern: /docs/grafana/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
  configure-pdc:
    - pattern: /docs/grafana/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
---

# Configure the Loki data source

This document provides instructions for configuring the Loki data source and explains available configuration options. For general information about data sources, refer to [Data source management](ref:data-source-management).

Grafana ships with built-in support for [Loki](https://grafana.com/docs/loki/latest/), an open-source log aggregation system by Grafana Labs. If you are new to Loki, the following documentation will help you get started:

- [Getting started](https://grafana.com/docs/loki/latest/get-started/)
- [Best practices](https://grafana.com/docs/loki/latest/best-practices/#best-practices)

## Before you begin

Before configuring the Loki data source, ensure you have the following:

- **Grafana permissions:** You must have the `Organization administrator` role to configure data sources. Organization administrators can also [configure the data source via YAML](#provision-the-data-source) with the Grafana provisioning system or [using Terraform](#provision-the-data-source-using-terraform).

- **Loki instance:** You need a running Loki instance and its URL. If you don't have one, refer to the [Loki installation documentation](https://grafana.com/docs/loki/latest/setup/install/).

- **Authentication details (if applicable):** If your Loki instance requires authentication, gather the necessary credentials such as username and password for basic authentication, or any required certificates for TLS authentication.

{{< admonition type="note" >}}
The Loki data source plugin is built into Grafana. No additional installation is required.
{{< /admonition >}}

## Add the Loki data source

To add the Loki data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Under **Connections**, click **Add new connection**.
1. Enter `Loki` in the search bar.
1. Select **Loki data source**.
1. Click **Create a Loki data source** in the upper right.

You are taken to the **Settings** tab where you will set up your Loki configuration.

## Configure Loki using the UI

The following are the configuration options for Loki.

| Name | Description |
| ---- | ----------- |
| **Name** | The data source name. This is how you refer to the data source in panels and queries. Examples: `loki-1`, `loki_logs`. |
| **Default** | Toggle to set this data source as the default. When enabled, new panels automatically use this data source. |

### Connection section

| Name | Description |
| ---- | ----------- |
| **URL** | The URL of your Loki server, including the port. The default Loki port is `3100`. Examples: `http://localhost:3100`, `http://loki.example.org:3100`. |

### Authentication section

Select an authentication method from the **Authentication** dropdown.

| Setting | Description |
| ---- | ----------- |
| **No authentication** | No authentication is required to access the data source. |
| **Basic authentication** | Authenticate using a username and password. Enter the credentials in the **User** and **Password** fields. |
| **Forward OAuth identity** | Forward the OAuth access token (and the OIDC ID token if available) of the user querying the data source. |

### TLS settings

Use TLS (Transport Layer Security) for an additional layer of security when working with Loki. For more information on setting up TLS encryption with Loki, refer to [Grafana Loki configuration parameters](https://grafana.com/docs/loki/latest/configuration/).

| Setting | Description |
| ---- | ----------- |
| **Add self-signed certificate** | Enable to add a self-signed CA certificate. When enabled, enter the certificate in the **CA Certificate** field. The certificate must begin with `-----BEGIN CERTIFICATE-----`. |
| **TLS Client Authentication** | Enable to use client certificate authentication. When enabled, enter the **ServerName** (for example, `domain.example.com`), **Client Certificate** (begins with `-----BEGIN CERTIFICATE-----`), and **Client Key** (begins with `-----BEGIN RSA PRIVATE KEY-----`). |
| **Skip TLS certificate validation** | Enable to bypass TLS certificate validation. Use this option only for testing or when connecting to Loki instances with self-signed certificates. |

### HTTP headers

Use HTTP headers to pass along additional context and metadata about the request/response.

| Setting | Description |
| ---- | ----------- |
| **Header** | The name of the custom header. For example, `X-Custom-Header`. |
| **Value** | The value of the custom header. For example, `Header value`. |

Click **+ Add another header** to add additional headers.

## Additional settings

Additional settings are optional settings that you can configure for more control over your data source.

### Advanced HTTP settings

| Setting | Description |
| ------- | ----------- |
| **Allowed cookies** | Specify cookies by name that should be forwarded to the data source. The Grafana proxy deletes all forwarded cookies by default. |
| **Timeout** | The HTTP request timeout in seconds. If not set, the default Grafana timeout is used. |

### Alerting

Manage alert rules for the Loki data source. For more information, refer to [Alerting](ref:alerting).

| Setting | Description |
| ------- | ----------- |
| **Manage alert rules in Alerting UI** | Toggle to manage alert rules for this Loki data source in the Grafana Alerting UI. |

### Queries

Configure options to customize your querying experience.

| Setting | Description |
| ------- | ----------- |
| **Maximum lines** | The maximum number of log lines returned by Loki. The default is `1000`. Increase for larger result sets during ad-hoc analysis. Decrease if your browser is sluggish when displaying log results. |

### Derived fields

Derived fields can be used to extract new fields from a log message and create a link from its value. For example, you can link to your tracing backend directly from your logs. These links appear in the [log details](ref:log-details).

Click **+ Add** to add a derived field. Each derived field has the following settings:

| Setting | Description |
| ------- | ----------- |
| **Name** | The field name. Displayed as a label in the log details. |
| **Type** | The type of derived field. Select **Regex in log line** to extract values using a regular expression, or **Label** to use an existing label value. |
| **Regex** | A regular expression to parse a part of the log message and capture it as the value of the new field. Can contain only one capture group. |
| **URL** | The full link URL if the link is external, or a query for the target data source if the link is internal. You can interpolate the value from the field with the `${__value.raw}` macro. For example, `http://example.com/${__value.raw}`. |
| **URL Label** | A custom display label for the link. This setting overrides the link label, which defaults to the full external URL or name of the linked internal data source. |
| **Internal link** | Toggle to define an internal link. When enabled, you can select the target data source from a selector. This supports only tracing data sources. |
| **Open in new tab** | Toggle to open the link in a new browser tab or window. |

{{< admonition type="caution" >}}
Using complex regular expressions can impact browser performance when processing large volumes of logs. Consider using simpler patterns when possible.
{{< /admonition >}}

#### Test derived fields

To test your derived field configuration:

1. Click **Show example log message** to display the debug section.
1. In the **Debug log message** field, paste an example log line to test the regular expressions of your derived fields.
1. Verify that the field extracts the expected value and the URL is interpolated correctly.

### Private data source connect

_Only for Grafana Cloud users._

Private data source connect, or PDC, allows you to establish a private, secured connection between a Grafana Cloud instance, or stack, and data sources secured within a private network. Click the drop-down to locate the URL for PDC. For more information regarding Grafana PDC, refer to [Private data source connect (PDC)](ref:private-data-source-connect) and [Configure Grafana private data source connect (PDC)](ref:configure-pdc) for instructions on setting up a PDC connection.

Click **Manage private data source connect** to open your PDC connection page and view your configuration details.

## Verify the connection

After configuring the data source, click **Save & test** to save your settings and verify the connection. A successful connection displays the following message:

**Data source successfully connected.**

If the test fails, verify:

- The Loki URL is correct and accessible from the Grafana server
- Any required authentication credentials are correct
- Network connectivity and firewall rules allow the connection
- TLS certificates are valid (if using HTTPS)

## Provision the data source

You can define and configure the data source in YAML files as part of the Grafana provisioning system.
For more information about provisioning, and for available configuration options, refer to [Provisioning Grafana](ref:provisioning-data-sources).

### Provisioning examples

```yaml
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://localhost:3100
    jsonData:
      timeout: 60
      maxLines: 1000
```

**Using basic authorization and a derived field:**

You must escape the dollar (`$`) character in YAML values because it can be used to interpolate environment variables:

```yaml
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://localhost:3100
    basicAuth: true
    basicAuthUser: my_user
    jsonData:
      maxLines: 1000
      derivedFields:
        # Field with internal link pointing to data source in Grafana.
        # datasourceUid value can be anything, but it should be unique across all defined data source uids.
        - datasourceUid: my_jaeger_uid
          matcherRegex: "traceID=(\\w+)"
          name: TraceID
          # url will be interpreted as query for the datasource
          url: '$${__value.raw}'
          # optional for URL Label to set a custom display label for the link.
          urlDisplayLabel: 'View Trace'

        # Field with external link.
        - matcherRegex: "traceID=(\\w+)"
          name: TraceID
          url: 'http://localhost:16686/trace/$${__value.raw}'
    secureJsonData:
      basicAuthPassword: test_password
```

**Using a Jaeger data source:**

In this example, the Jaeger data source's `uid` value should match the Loki data source's `datasourceUid` value.

```yaml
apiVersion: 1

datasources:
  - name: Jaeger
    type: jaeger
    url: http://jaeger-tracing-query:16686/
    access: proxy
    # UID should match the datasourceUid in derivedFields.
    uid: my_jaeger_uid
```

## Provision the data source using Terraform

You can provision the Loki data source using [Terraform](https://www.terraform.io/) with the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs).

For more information about provisioning resources with Terraform, refer to the [Grafana as code using Terraform](https://grafana.com/docs/grafana-cloud/developer-resources/infrastructure-as-code/terraform/) documentation.

### Basic Terraform example

The following example creates a basic Loki data source:

```hcl
resource "grafana_data_source" "loki" {
  name = "Loki"
  type = "loki"
  url  = "http://localhost:3100"

  json_data_encoded = jsonencode({
    maxLines = 1000
  })
}
```

### Terraform example with derived fields

The following example creates a Loki data source with a derived field that links to a Jaeger data source for trace correlation:

```hcl
resource "grafana_data_source" "loki_with_tracing" {
  name = "Loki"
  type = "loki"
  url  = "http://localhost:3100"

  json_data_encoded = jsonencode({
    maxLines = 1000
    derivedFields = [
      {
        datasourceUid = grafana_data_source.jaeger.uid
        matcherRegex  = "traceID=(\\w+)"
        name          = "TraceID"
        url           = "$${__value.raw}"
        urlDisplayLabel = "View Trace"
      }
    ]
  })
}
```

### Terraform example with basic authentication

The following example includes basic authentication:

```hcl
resource "grafana_data_source" "loki_auth" {
  name = "Loki"
  type = "loki"
  url  = "http://localhost:3100"

  basic_auth_enabled  = true
  basic_auth_username = "loki_user"

  secure_json_data_encoded = jsonencode({
    basicAuthPassword = var.loki_password
  })

  json_data_encoded = jsonencode({
    maxLines = 1000
  })
}
```

For all available configuration options, refer to the [Grafana provider data source resource documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source).

## Next steps

After configuring your Loki data source, explore these resources:

- [Query the Loki data source](../query-editor/) to learn how to build LogQL queries in Grafana
- [Use template variables](../template-variables/) to create dynamic, reusable dashboards
- [LogQL documentation](https://grafana.com/docs/loki/latest/query/) to learn more about the Loki query language