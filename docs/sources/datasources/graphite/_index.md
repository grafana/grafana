---
aliases:
  - ../data-sources/graphite/
  - ../features/datasources/graphite/
description: Guide for using Graphite in Grafana
keywords:
  - grafana
  - graphite
  - guide
menuTitle: Graphite
title: Graphite data source
weight: 600
---

# Graphite data source

Grafana includes built-in support for Graphite.
This topic explains options, variables, querying, and other features specific to the Graphite data source, which include its feature-rich query editor.

For instructions on how to add a data source to Grafana, refer to the [administration documentation]({{< relref "../../administration/data-source-management/" >}}).
Only users with the organization administrator role can add data sources.

Once you've added the Graphite data source, you can [configure it]({{< relref "#configure-the-data-source" >}}) so that your Grafana instance's users can create queries in its [query editor]({{< relref "./query-editor/" >}}) when they [build dashboards]({{< relref "../../dashboards/build-dashboards/" >}}) and use [Explore]({{< relref "../../explore/" >}}).

## Configure the data source

To configure basic settings for the data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Under Your connections, click **Data sources**.
1. Enter `Graphite` in the search bar.
1. Click **Graphite**.

   The **Settings** tab of the data source is displayed.

1. Set the data source's basic configuration options:

   | Name                    | Description                                                                                                                          |
   | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
   | **Name**                | Sets the name you use to refer to the data source in panels and queries.                                                             |
   | **Default**             | Sets whether the data source is pre-selected for new panels. You can set only one default data source per organization.              |
   | **URL**                 | Sets the HTTP protocol, IP, and port of your graphite-web or graphite-api installation.                                              |
   | **Auth**                | For details, refer to [Configure Authentication]({{< relref "../../setup-grafana/configure-security/configure-authentication/" >}}). |
   | **Basic Auth**          | Enables basic authentication to the data source.                                                                                     |
   | **User**                | Sets the user name for basic authentication.                                                                                         |
   | **Password**            | Sets the password for basic authentication.                                                                                          |
   | **Custom HTTP Headers** | Click **Add header** to add a custom HTTP header.                                                                                    |
   | **Header**              | Defines the custom header name.                                                                                                      |
   | **Value**               | Defines the custom header value.                                                                                                     |

You can also configure settings specific to the Graphite data source:

| Name        | Description                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| **Version** | Select your version of Graphite. If you are using Grafana Cloud Graphite, this should be set to `1.1.x`. |
| **Type**    | Select your type of Graphite. If you are using Grafana Cloud Graphite, this should be set to `Default`.  |

### Integrate with Loki

When you change the data source selection in [Explore]({{< relref "../../explore/" >}}), Graphite queries are converted to Loki queries.
Grafana extracts Loki label names and values from the Graphite queries according to mappings provided in the Graphite data source configuration.
Queries using tags with `seriesByTags()` are also transformed without any additional setup.

### Provision the data source

You can define and configure the data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning, and for lists of common configuration options and JSON data options, refer to [Provisioning data sources]({{< relref "../../administration/provisioning/#data-sources" >}}).

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

For details, refer to the [query editor documentation]({{< relref "./query-editor/" >}}).

## Use template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For details, see the [template variables documentation]({{< relref "./template-variables/" >}}).

## Get Grafana metrics into Graphite

Grafana exposes metrics for Graphite on the `/metrics` endpoint.
For detailed instructions, refer to [Internal Grafana metrics]({{< relref "../../setup-grafana/set-up-grafana-monitoring" >}}).
