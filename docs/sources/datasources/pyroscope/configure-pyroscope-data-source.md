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
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/provision
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
---

# Configure the Grafana Pyroscope data source

The Pyroscope data source sets how Grafana connects to your Pyroscope database.

You can configure the data source using either the data source interface within Grafana or using a configuration file.
This page explains how to set up and enable the data source capabilities using Grafana.

If you make any changes, select **Save & test** to preserve those changes.

If you are using your own installation of Grafana, you can provision the Pyroscope data source using a YAML configuration file.
For more information about provisioning and available configuration options, refer to [Provisioning Grafana](ref:provisioning-data-sources).

## Before you begin

To configure a Pyroscope data source, you need administrator rights to your Grafana instance and a Pyroscope instance configured to send data to Grafana.

If you are provisioning a Pyroscope data source, then you also need administrative rights on the server hosting your Grafana instance.

## Set up the data source

To configure basic settings for the data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Under Your connections, click **Data sources**.
1. Enter `Grafana Pyroscope` in the search bar.
1. Select **Add new data source**.
1. Click **Grafana Pyroscope** to display the **Settings** tab of the data source.
1. On the **Settings** tab, set the data source's basic configuration options. At a minimum, you need to complete the **Name**, **Connection**, and **Authentication** sections. The other sections provide optional capabilities.
1. Select **Save & test**.

## Name and default

Use the **Name** field to specify the name used for the data source in panels, queries, and Explore.

Activate **Default** if you want the data source to be pre-selected for new panels.

## Connection

The required **Connection** field provides the connection point for your Pyroscope instance.

1. Enter the **URL** of the Pyroscope instance, for example, `https://example.com:4100`.

1. Select **Save & test** to preserve your changes.

## Authentication

Use this section to select an authentication method to access the data source.

{{< admonition type="note" >}}
Use Transport Layer Security (TLS) for an additional layer of security when working with Pyroscope.
For additional information on setting up TLS encryption with Pyroscope, refer to [Pyroscope configuration](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/configure-server/reference-configuration-parameters/).
{{< /admonition >}}

[//]: # 'Shared content for authentication section procedure in data sources'

{{< docs/shared source="grafana" lookup="datasources/datasouce-authentication.md" leveloffset="+2" version="<GRAFANA_VERSION>" >}}

## Additional settings

Use the down-arrow to expand the **Additional settings** section to view these options.

### Advanced HTTP settings

The Grafana Proxy deletes forwarded cookies. Use the **Allowed cookies** field to specify cookies by name that should be forwarded to the data source.

The **Timeout** field sets the HTTP request timeout in seconds.

### Querying

**Minimum step** is used for queries returning time-series data. The default value is 15 seconds.

Adjusting this option can help prevent gaps when you zoom in to profiling data.

### Private data source connect

[//]: # 'Shared content for authentication section procedure in data sources'

{{< docs/shared source="grafana" lookup="datasources/datasouce-private-ds-connect.md" leveloffset="+2" version="<GRAFANA_VERSION>" >}}
