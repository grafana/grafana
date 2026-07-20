---
aliases:
  - ../../parca/
description: Configure the Parca data source in Grafana to connect to your Parca
  continuous profiling instance.
keywords:
  - grafana
  - parca
  - configure
  - profiling
  - data source
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure
title: Configure the Parca data source
weight: 200
review_date: 2026-04-10
---

# Configure the Parca data source

This document explains how to configure the Parca data source in Grafana.

You can configure the data source using the Grafana UI, a YAML provisioning file, or Terraform.
If you make any changes in the UI, select **Save & test** to preserve those changes.

## Before you begin

Before configuring the data source, ensure you have:

- **Grafana permissions:** `Organization administrator` role.
- **Parca instance:** A running Parca instance (v0.19 or later) accessible from your Grafana server.

If you're provisioning the data source, you also need administrative rights on the server hosting your Grafana instance.

## Add the data source

To add the Parca data source:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**.
1. Type `Parca` in the search bar.
1. Select **Parca**.
1. Click **Add new data source**.

## Configure settings

The **Settings** tab contains the following configuration sections.

### Basic settings

| Setting     | Description                                                          |
| ----------- | -------------------------------------------------------------------- |
| **Name**    | A name to identify this data source in panels, queries, and Explore. |
| **Default** | Toggle to make this the default data source for new panels.          |

### Connection

| Setting | Description                                                                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL** | The URL of your Parca instance. For example, `http://localhost:7070`. Grafana connects to Parca using gRPC-Web, so the URL should point to the Parca HTTP endpoint. |

### Authentication

Use this section to select an authentication method to access the data source. The available methods are:

| Method                     | Description                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| **Basic authentication**   | Authenticate with a username and password. Enter values in the **User** and **Password** fields. |
| **Forward OAuth Identity** | Forward the logged-in user's OAuth token to the data source.                                     |
| **No Authentication**      | Connect without credentials. Use this when the Parca instance doesn't require authentication.    |

### TLS settings

Configure TLS for secure communication with your Parca instance.

| Setting                             | Description                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Add self-signed certificate**     | Toggle to provide a CA certificate. When enabled, paste the CA certificate in the **CA Certificate** field.         |
| **TLS Client Authentication**       | Toggle to enable mutual TLS. When enabled, provide the **Server Name**, **Client Certificate**, and **Client Key**. |
| **Skip TLS certificate validation** | Toggle to skip server certificate verification. Use only for testing.                                               |

{{< admonition type="note" >}}
Use Transport Layer Security (TLS) for an additional layer of security when working with Parca.
{{< /admonition >}}

### Custom HTTP headers

Add custom HTTP headers to requests sent to the Parca instance. Click **Add header** to add a new row with **Header** (name) and **Value** (secret) fields.

Custom headers are useful for passing authentication tokens or routing information required by proxies between Grafana and Parca.

## Additional settings

Click the down arrow to expand the **Additional settings** section. These settings are optional.

### Advanced HTTP settings

| Setting             | Description                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| **Allowed cookies** | Cookies that should be forwarded to the data source. The Grafana proxy strips all cookies by default. |
| **Timeout**         | The HTTP request timeout in seconds.                                                                  |

### Secure SOCKS proxy

{{< admonition type="note" >}}
This section is only visible when the Grafana server has the secure SOCKS proxy feature enabled.
{{< /admonition >}}

| Setting     | Description                                                                  |
| ----------- | ---------------------------------------------------------------------------- |
| **Enabled** | Toggle to route requests to the Parca instance through a secure SOCKS proxy. |

## Verify the connection

Click **Save & test** to verify that Grafana can connect to your Parca instance. The health check queries the available profile types from the Parca server. A successful connection displays the message

**Data source is working**.

If the test fails, verify that the URL is correct and that your Parca instance is running and accessible from the Grafana server. For more help, refer to [Troubleshoot Parca data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/troubleshooting/).

## Provision the data source

You can define the data source in YAML files as part of the Grafana provisioning system.
For more information, refer to [Provisioning Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources).

### YAML provisioning example

```yaml
apiVersion: 1

datasources:
  - name: Parca
    type: parca
    url: http://localhost:7070
```

To provision with basic authentication:

```yaml
apiVersion: 1

datasources:
  - name: Parca
    type: parca
    url: http://localhost:7070
    basicAuth: true
    basicAuthUser: <USERNAME>
    secureJsonData:
      basicAuthPassword: <PASSWORD>
```

Replace the following:

- `<USERNAME>`: Your Parca username.
- `<PASSWORD>`: Your Parca password.

### Terraform example

To provision the data source with Terraform, use the [`grafana_data_source` resource](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source):

```hcl
resource "grafana_data_source" "parca" {
  type = "parca"
  name = "Parca"
  url  = "http://localhost:7070"
}
```

To provision with basic authentication:

```hcl
resource "grafana_data_source" "parca" {
  type                = "parca"
  name                = "Parca"
  url                 = "http://localhost:7070"
  basic_auth_enabled  = true
  basic_auth_username = "<USERNAME>"

  secure_json_data_encoded = jsonencode({
    basicAuthPassword = "<PASSWORD>"
  })
}
```

Replace the following:

- `<USERNAME>`: Your Parca username.
- `<PASSWORD>`: Your Parca password.

## Next steps

- [Query profiling data with the Parca query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/query-editor/)
