---
description: Configure your Pyroscope data source for Grafana.
keywords:
  - configure
  - profiling
  - pyroscope
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Configure the Grafana Pyroscope data source
menuTitle: Configure Pyroscope
weight: 200
refs:
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#datasources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#datasources
  flame-graph:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/flame-graph/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/flame-graph/
  configure-tempo-data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/
    - pattern: /docs/grafana-cloud/
      destination: docs/grafana-cloud/connect-externally-hosted/data-sources/tempo/configure-tempo-data-source/
---

# Configure the Grafana Pyroscope data source

To configure basic settings for the data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Under Your connections, click **Data sources**.
1. Enter `Grafana Pyroscope` in the search bar.
1. Select **Add new data source**.
1. Click **Grafana Pyroscope** to display the **Settings** tab of the data source.
1. Set the data source's basic configuration options.
1. Select **Save & test**.

## Configuration options

You can configure several options for the Pyroscope data source, including the name, HTTP, authentication, querying, and private data source connect.

If you make any changes, select **Save & test** to preserve those changes.

![Configuration options for the Pyroscope data source](/media/docs/grafana/data-sources/screenshot-pyroscope-data-source-config.png)

### Name and default

**Name**
: Enter a name to specify the data source in panels, queries, and Explore.

**Default**
: The default data source is pre-selected for new panels.

### HTTP

The HTTP section is shown in number 1 in the screenshot.

**URL**
: The URL of the Grafana Pyroscope instance, for example, `https://localhost:4100`.

**Allowed cookies**
: The Grafana Proxy deletes forwarded cookies. Use this field to specify cookies by name that should be forwarded to the data source.

**Timeout**
: HTTP request timeout in seconds.

### Auth

The Auth section is shown in number 2 in the screenshot.

**Basic auth**
: Enable basic authentication to the data source. When activated, it provides **User** and **Password** fields.

**With Credentials**
: Whether credentials, such as cookies or auth headers, should be sent with cross-site requests.

**TLS Client Auth**
: Toggle on to use client authentication. When enabled, it adds the **Server name**, **Client cert**, and **Client key** fields. The client provides a certificate that is validated by the server to establish the client's trusted identity. The client key encrypts the data between client and server. These details are encrypted and stored in the Grafana database.

**With CA Cert**
: Activate this option to verify self-signed TLS certificates.

**Skip TLS Verify**
: When activated, it bypasses TLS certificate verification.

**Forward OAuth Identity**
: When activated, the user’s upstream OAuth 2.0 identity is forwarded to the data source along with their access token.

**Custom HTTP Headers**
: Select Add header to add Header and Value fields.

**Header**
: Add a custom header. This allows custom headers to be passed based on the needs of your Pyroscope instance.

**Value**
: The value of the header.

### Querying

The **Querying** section is shown in number 3 in the screenshot.

**Minimum step** is used for queries returning time-series data. The default value is 15 seconds.

Adjusting this option can help prevent gaps when you zoom in to profiling data. 

### Private data source connect

The **Private data source connect** section is shown in number 4 in the screenshot.

This feature is only available in Grafana Cloud.

This option lets you query data that lives within a secured network without opening the network to inbound traffic from Grafana Cloud.

Use the drop-down box to select a configured private data sources.

Select **Manage private data source connect** to configure and manage any private data sources you have configured.

For more information, refer to [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/).
