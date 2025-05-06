---
aliases:
  - ../data-sources/graphite/
  - ../features/datasources/graphite/
description: Guide for using Graphite in Grafana
keywords:
  - grafana
  - graphite
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure the Graphite data source
title: Graphite data source
weight: 100
refs:
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
  internal-grafana-metrics:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/set-up-grafana-monitoring/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/set-up-grafana-monitoring/
  build-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
  configure-authentication:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
---

# Configure the Graphite the data source

This document provides instructions for configuring the Graphite data source and explains available configuration options. For general information on managing data sources, refer to [Data source management](ref:data-source-management).

## Before you begin

- You must have the `Organization administrator` role to configure the Postgres data source.
  Organization administrators can also [configure the data source via YAML](#provision-the-data-source) with the Grafana provisioning system.

- Grafana comes with a built-in Graphite data source plugin, eliminating the need to install a plugin.

- Familiarize yourself with your Graphite security configuration and gather any necessary security certificates and client keys.

- Verify that data from Graphite is being written to your Grafana instance.

## Add the Graphite data source

To configure basic settings for the data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**
1. Type `Graphite` in the search bar.
1. Select the **Graphite data source**.
1. Click **Add new data source** in the upper right.

Grafana takes you to the **Settings** tab, where you will set up your Graphite configuration.

## Configuration options in the UI

Following is a list of configuration options for Graphite.

- **Name** - The data source name. Sets the name you use to refer to the data source in panels and queries. Examples: graphite-1, prom-metrics.
- **Default** - Toggle on to select as the default name in dashboard panels. When you go to a dashboard panel, this will be the default selected data source.

**HTTP:**

- **URL** - Sets the HTTP protocol, IP, and port of your graphite-web or graphite-api installation. Since your access method is set to Server, the URL must be accessible from the Grafana backend (server-side).
- **Allowed cookies** - Grafana proxy deletes forwarded cookies by default. Specify cookies by name to forward them to the data source..
- **Timeout** - Add an HTTP request timeout in seconds.

**Auth:**

- **Basic Auth** - Toggle on to enable basic authentication to the data source.

  - **Basic Auth Details:**
    - User - Sets the user name used for basic authentication.
    - Password - Enter the password used for basic authentication.

- **With Credentials** - Toggle on to specify if cookies and authentication headers should be included in cross-origin requests.

- **TLS Client Auth** - Toggle on to enable TLS client authentication (server and client are both verified). When toggled, add the following under TLS/SSL Auth Details:

  - **ServerName** - Specify the server name used to verify the hostname on the certificate returned by the server.
  - **Client Cert** - The client certificate is generated from a Certificate Authority or its self-signed. Follow the instructions of the CA (Certificate Authority) to download the certificate file.
  - **Client Key** - Add your client key, which can also be generated from a Certificate Authority (CA) or be self-signed. The client key encrypts data between the client and server.

- **With CA Cert** - Toggle on to authenticate with a CA certificate.

  - **CA Cert** - Add your certificate.

- **Skip TLS Verify** - Toggle on to bypass TLS certificate validation. Skipping TLS certificate validation is not recommended unless necessary or for testing purposes.

- **Forward OAuth Identity** - Toggle on to forward the user's upstream OAuth identity to
  the data source. Grafana forwards the access token as part of the request.

**Custom HTTP Headers:**

Pass along additional information and metadata about the request or response.

- **Header** - Add a custom header. This allows custom headers to be passed based on the needs of your Prometheus instance.
- **Value** - The value of the header.

**Graphite details:**

- **Version** - Select your Graphite version from the dorp-down. This settings controls what functions are available in the Graphite query editor. If you are using Grafana Cloud Graphite, this should be set to `1.1.x`.

- **Graphite backend type** - Select the Graphite backend type from the drop-down. Selecting `Metrictank` enables additional features like query processing metadata.
  `Metrictank` is a multi-tenant time series engine compatible with Graphite.
  Use `Default` if you are connecting to Grafana Cloud Graphite.
  - **Rollup indicator** - Enable to display an info icon in panel headers when data aggregation occurs.

**Label mappings:**

Label mappings are the rules you define to tell Grafana how to pull pieces of the Graphite metric path into Loki labels when switching data sources. They are currently only supported between Graphite and Loki queries.

When you change your data source from Graphite to Loki, your queries are automatically mapped based on the rules you define. To create a mapping, specify the full path of the metric and replace the nodes you want to map with label names, using parentheses.

The corresponding label values are extracted from your Graphite query during the data source switch.

All Graphite tags are automatically mapped to labels, regardless of your defined mappings.
Graphite matching patterns using `{}` are converted to Loki’s regular expression matching syntax.
When your queries include functions, Graphite extracts the associated metrics and tags to match them against your mappings.

| **Graphite Query**                                       | **Mapped to Loki Query**         |
| -------------------------------------------------------- | -------------------------------- |
| `alias(servers.west.001.cpu,1,2)`                        | `{cluster="west", server="001"}` |
| `alias(servers.*.{001,002}.*,1,2)`                       | `{server=~"(001,002)"}`          |
| `interpolate(seriesByTag('foo=bar', 'server=002'), inf)` | `{foo="bar", server="002"}`      |

- **Private data source connect** - _Only for Grafana Cloud users._ Private data source connect, or PDC, allows you to establish a private, secured connection between a Grafana Cloud instance, or stack, and data sources secured within a private network. Click the drop-down to locate the URL for PDC. For more information regarding Grafana PDC refer to [Private data source connect (PDC)](ref:private-data-source-connect) and [Configure Grafana private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc) for steps on setting up a PDC connection.

Click **Manage private data source connect**to open your PDC connection page and view your configuration details.

After configuring your Graphite data source options, click **Save & test** at the bottom to test the connection.

You should see a confirmation dialog box that says:

**\*\***insert a success message**\*\*\*\***

<!-- 1. Set the data source's basic configuration options:


   | Name                    | Description                                                                                                             |
   | ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
   | **Name**                | Sets the name you use to refer to the data source in panels and queries.                                                |
   | **Default**             | Sets whether the data source is pre-selected for new panels. You can set only one default data source per organization. |
   | **URL**                 | Sets the HTTP protocol, IP, and port of your graphite-web or graphite-api installation.                                 |
   | **Auth**                | For details, refer to [Configure Authentication](ref:configure-authentication).                                         |
   | **Basic Auth**          | Enables basic authentication to the data source.                                                                        |
   | **User**                | Sets the user name for basic authentication.                                                                            |
   | **Password**            | Sets the password for basic authentication.                                                                             |
   | **Custom HTTP Headers** | Click **Add header** to add a custom HTTP header.                                                                       |
   | **Header**              | Defines the custom header name.                                                                                         |
   | **Value**               | Defines the custom header value.                                                                                        |

You can also configure settings specific to the Graphite data source:

| Name        | Description                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| **Version** | Select your version of Graphite. If you are using Grafana Cloud Graphite, this should be set to `1.1.x`. |
| **Type**    | Select your type of Graphite. If you are using Grafana Cloud Graphite, this should be set to `Default`.  | -->

## Provision the data source

You can define and configure the data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning, and for lists of common configuration options and JSON data options, refer to [Provisioning data sources](ref:provisioning-data-sources).

Example Graphite YAML provisioning file:

```yaml
apiVersion: 1

datasources:
  - name: Graphite
    type: graphite
    access: proxy
    url: http://localhost:8080
    jsonData:
      graphiteVersion: '1.1'
```
