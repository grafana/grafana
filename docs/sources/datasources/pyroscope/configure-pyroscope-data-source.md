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
  explore-profiles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/simplified-exploration/profiles/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/simplified-exploration/profiles/
---

# Configure the Grafana Pyroscope data source

The Pyroscope data source sets how Grafana connects to your Pyroscope database.

You can configure the data source using either the data source interface in Grafana or using a configuration file.
This page explains how to set up and enable the data source capabilities using Grafana.

If you make any changes, select **Save & test** to preserve those changes.

If you're using your own installation of Grafana, you can provision the Pyroscope data source using a YAML configuration file.
For more information about provisioning and available configuration options, refer to [Provisioning Grafana](ref:provisioning-data-sources).

## Before you begin

To configure a Pyroscope data source, you need administrator rights to your Grafana instance and a Pyroscope instance configured to send data to Grafana.

If you're provisioning a Pyroscope data source, then you also need administrative rights on the server hosting your Grafana instance.

## Add or modify a data source

You can use these procedures to configure a new Pyroscope data source or to edit an existing one.

### Create a new data source

To configure basic settings for the data source, complete the following steps:

1. Select **Connections** in the main menu.
1. Enter `Grafana Pyroscope` in the search bar.
1. Select **Grafana Pyroscope**.
1. Select **Add new data source** in the top-right corner of the page.
1. On the **Settings** tab, complete the **Name**, **Connection**, and **Authentication** sections.

- Use the **Name** field to specify the name used for the data source in panels, queries, and Explore. Toggle the **Default** switch for the data source to be pre-selected for new panels.
- Under **Connection**, enter the **URL** of the Pyroscope instance. For example, `https://example.com:4100`. Refer to [Connection URL](#connection-url) for more information.
- Complete the [**Authentication** section](#authentication).

1. Optional: Use **Additional settings** to configure other options.
1. Select **Save & test**.

### Update an existing data source

To modify an existing Pyroscope data source:

1. Select **Connections** in the main menu.
1. Select **Data sources** to view a list of configured data sources.
1. Select the Pyroscope data source you wish to modify.
1. Optional: Use **Additional settings** to configure or modify other options.
1. After completing your updates, select **Save & test**.

#### Connection URL

The data source connection URL should point to a location of a running Pyroscope backend.

**Grafana Cloud Profiles**

Your Grafana Cloud instance automatically includes a fully provisioned data source.

If you are running a self-managed Grafana instance or need to configure an additional Pyroscope data source pointing to Grafana Cloud Profiles, you can find the Pyroscope URL under the **Manage your stack** section for your organization.

**Self-managed Pyroscope backend**

The connection URL for a self-managed Pyroscope backend depends on how Pyroscope is deployed.
Refer to the steps under [Query profiles in Grafana](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/deploy-kubernetes/helm/#query-profiles-in-grafana) for more information on how to configure the data source.

If you plan to use the [Profiles Drilldown](ref:explore-profiles) application and you are running a self-managed Pyroscope backend in microservices mode, the data source connection URL should point to a gateway or proxy that routes requests to the corresponding Pyroscope service.
Refer to the [Helm ingress configuration](https://github.com/grafana/pyroscope/blob/main/operations/pyroscope/helm/pyroscope/templates/ingress.yaml) for specific routing requirements.

## Authentication

Use this section to select an authentication method to access the data source.

{{< admonition type="note" >}}
Use Transport Layer Security (TLS) for an additional layer of security when working with Pyroscope.
For additional information on setting up TLS encryption with Pyroscope, refer to [Pyroscope configuration](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/configure-server/reference-configuration-parameters/).
{{< /admonition >}}

[//]: # 'Shared content for authentication section procedure in data sources'

{{< docs/shared source="grafana" lookup="datasources/datasouce-authentication.md" leveloffset="+2" version="<GRAFANA_VERSION>" >}}

## Additional settings

Use the down arrow to expand the **Additional settings** section to view these options.

### Advanced HTTP settings

The Grafana Proxy deletes forwarded cookies. Use the **Allowed cookies** field to specify cookies that should be forwarded to the data source by name.

The **Timeout** field sets the HTTP request timeout in seconds.

### Querying

**Minimum step** is used for queries returning time-series data. The default value is 15 seconds.

Adjusting this option can help prevent gaps when you zoom in to profiling data.

### Private data source connect

[//]: # 'Shared content for authentication section procedure in data sources'

{{< docs/shared source="grafana" lookup="datasources/datasouce-private-ds-connect.md" leveloffset="+2" version="<GRAFANA_VERSION>" >}}
