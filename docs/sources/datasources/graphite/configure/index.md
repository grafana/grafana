---
aliases:
  - ../data-sources/graphite/
  - ../datasources/graphite/
  - ../features/datasources/graphite/
description: This document provides instructions for configuring the Graphite data source.
keywords:
  - grafana
  - graphite
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure
title: Configure the Graphite data source
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
  private-data-source-connect:
    - pattern: /docs/grafana/
      destination: docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
    - pattern: /docs/grafana-cloud/
      destination: docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
  configure-pdc:
    - pattern: /docs/grafana/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc
---

# Configure the Graphite data source

This document provides instructions for configuring the Graphite data source and explains available configuration options. For general information on managing data sources, refer to [Data source management](ref:data-source-management).

## Before you begin

- You must have the `Organization administrator` role to configure the Graphite data source.
  Organization administrators can also [configure the data source via YAML](#provision-the-data-source) with the Grafana provisioning system.

- Grafana comes with a built-in Graphite data source plugin, eliminating the need to install a plugin.

- Familiarize yourself with your Graphite security configuration and gather any necessary security certificates and client keys.

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

| Setting     | Description                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**    | The display name for the data source. This is how you'll reference it in panels and queries. <br>Examples: `graphite-1`, `graphite-metrics`. |
| **Default** | When enabled, sets this data source as the default for dashboard panels. It will be automatically selected when creating new panels.         |

**HTTP:**

| Setting             | Description                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **URL**             | Sets the HTTP protocol, IP, and port of your `graphite-web` or `graphite-api` installation. <br>Since the access method is set to _Server_, the URL must be accessible from the Grafana backend. |
| **Allowed cookies** | By default, Grafana removes forwarded cookies. Specify cookie names here to allow them to be forwarded to the data source.                                                                       |
| **Timeout**         | Sets the HTTP request timeout in seconds.                                                                                                                                                        |

**Auth:**

| **Setting**                 | **Description**                                                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Basic Auth**              | Toggle on to enable basic authentication to the data source.                                                                  |
| &nbsp;&nbsp;**User**        | Sets the username used for basic authentication.                                                                              |
| &nbsp;&nbsp;**Password**    | Enter the password used for basic authentication.                                                                             |
| **With Credentials**        | Toggle on to include cookies and authentication headers in cross-origin requests.                                             |
| **TLS Client Auth**         | Toggle on to enable TLS client authentication (both server and client are verified).                                          |
| &nbsp;&nbsp;**ServerName**  | The server name used to verify the hostname on the certificate returned by the server.                                        |
| &nbsp;&nbsp;**Client Cert** | Client certificate generated by a Certificate Authority (CA) or self-signed.                                                  |
| &nbsp;&nbsp;**Client Key**  | Private key used to encrypt communication between the client and server. Also generated by a CA or self-signed.               |
| **With CA Cert**            | Toggle on to authenticate with a CA certificate.                                                                              |
| &nbsp;&nbsp;**CA Cert**     | CA certificate used to validate the server certificate.                                                                       |
| **Skip TLS Verify**         | Toggle on to bypass TLS certificate validation. Not recommended unless necessary or for testing purposes.                     |
| **Forward OAuth Identity**  | Toggle on to forward the user's upstream OAuth identity to the data source. Grafana includes the access token in the request. |

**Custom HTTP Headers:**

Pass along additional information and metadata about the request or response.

| **Setting** | **Description**                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| **Header**  | Add a custom header. This allows custom headers to be passed based on the needs of your Graphite instance. |
| **Value**   | The value of the header.                                                                                   |

**Graphite details:**

| **Setting**               | **Description**                                                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Version**               | Select your Graphite version from the drop-down. This controls which functions are available in the Graphite query editor. Use `1.1.x` for Grafana Cloud Graphite.                                                                          |
| **Graphite backend type** | Select the Graphite backend type. Choosing `Metrictank` enables additional features like query processing metadata. (`Metrictank` is a multi-tenant time series engine compatible with Graphite.) Use `Default` for Grafana Cloud Graphite. |
| **Rollup indicator**      | Toggle on to display an info icon in panel headers when data aggregation (rollup) occurs. Only available when `Metrictank` is selected.                                                                                                     |

**Label mappings:**

Label mappings are the rules you define to tell Grafana how to pull pieces of the Graphite metric path into Loki labels when switching data sources. They are currently only supported between Graphite and Loki queries.

When you change your data source from Graphite to Loki, your queries are automatically mapped based on the rules you define. To create a mapping, specify the full path of the metric and replace the nodes you want to map with label names, using parentheses. The corresponding label values are extracted from your Graphite query during the data source switch.

Grafana automatically maps all Graphite tags to labels, even if you haven’t defined explicit mappings. When using matching patterns with `{}`(e.g., `metric.{a,b}.value`), Grafana converts them to Loki’s regular expression matching syntax. If your queries include functions, Graphite extracts the relevant metrics and tags, then matches them against your mappings.

| **Graphite Query**                                       | **Mapped to Loki Query**         |
| -------------------------------------------------------- | -------------------------------- |
| `alias(servers.west.001.cpu,1,2)`                        | `{cluster="west", server="001"}` |
| `alias(servers.*.{001,002}.*,1,2)`                       | `{server=~"(001,002)"}`          |
| `interpolate(seriesByTag('foo=bar', 'server=002'), inf)` | `{foo="bar", server="002"}`      |

| **Setting**                     | **Description**                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Private data source connect** | _Only for Grafana Cloud users._ Establishes a private, secured connection between a Grafana Cloud stack and data sources within a private network. Use the drop-down to locate the PDC URL. For setup instructions, refer to [Private data source connect (PDC)](ref:private-data-source-connect) and [Configure PDC](ref:configure-pdc). Click **Manage private data source connect** to open your PDC connection page and view your configuration details. |

|

After configuring your Graphite data source options, click **Save & test** at the bottom to test the connection. You should see a confirmation dialog box that says:

**Data source is working**

## Provision the data source

You can define and configure the data source in YAML files as part of the Grafana provisioning system.
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
