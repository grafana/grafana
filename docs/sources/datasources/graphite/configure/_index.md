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

## Add the Graphite data source

To configure basic settings for the data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**
1. Type `Graphite` in the search bar.
1. Select the **Graphite data source**.
1. Click **Add new data source** in the upper right.

The **Settings** tab of the data source is displayed.

1. Set the data source's basic configuration options:

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
| **Type**    | Select your type of Graphite. If you are using Grafana Cloud Graphite, this should be set to `Default`.  |

### Provision the data source

You can define and configure the data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning, and for lists of common configuration options and JSON data options, refer to [Provisioning data sources](ref:provisioning-data-sources).

#### Provisioning example

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

## Query the data source

Grafana includes a Graphite-specific query editor to help you build queries.
The query editor helps you quickly navigate the metric space, add functions, and change function parameters.
It can handle all types of Graphite queries, including complex nested queries through the use of query references.

For details, refer to the [query editor documentation](query-editor/).
