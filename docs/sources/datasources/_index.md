---
aliases:
  - data-sources/
  - overview/
  - ./features/datasources/
description: Learn how to manage, configure, and query built-in and plugin data sources in Grafana.
keywords:
  - grafana
  - data source
  - datasource
  - query
  - plugin
  - configure
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Data sources
title: Data sources
weight: 60
review_date: 2026-03-10
refs:
  query-transform-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
  alerts:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
  grafana-enterprise:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/
  organization-roles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/#organization-roles
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/#organization-roles
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  plugin-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/plugin-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/plugin-management/
  panels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
---

# Data sources

Grafana comes with built-in support for many _data sources_.
If you need other data sources, you can also install one of the many data source plugins.
If the plugin you need doesn't exist, you can develop a custom plugin.

Each data source comes with a _query editor_,
which formulates custom queries according to the source's structure.
After you add and configure a data source, you can use it as an input for many operations, including:

- Query the data with [Explore](ref:explore).
- Visualize it in [panels](ref:panels).
- Create rules for [alerts](ref:alerts).

This documentation describes how to manage data sources in general,
and how to configure or query the built-in data sources.

For other available plugins, refer to the list of [documented plugins](https://grafana.com/docs/plugins/) or browse the [Plugin catalog](/grafana/plugins/). To develop a custom plugin, refer to [Create a data source plugin](#create-a-data-source-plugin).

{{< admonition type="note" >}}
Grafana Cloud includes pre-configured data sources for Prometheus, Loki, and Tempo, so you can start querying without additional setup. Refer to [Grafana Cloud documentation](https://grafana.com/docs/grafana-cloud/) for details.
{{< /admonition >}}

## Manage data sources

Only users with the [organization administrator role](ref:organization-roles) can add or remove data sources.
To access data source management tools in Grafana as an administrator, navigate to **Connections > Data sources** in the left-side menu.

For details on data source management, including instructions on how to configure user permissions for queries, refer to the [administration documentation](ref:data-source-management).

## Add a data source

Before you can create your first dashboard, you need to add your data source.

{{< admonition type="note" >}}
Only users with the organization admin role can add data sources.
{{< /admonition >}}

**To add a data source:**

1. Click **Connections** in the left-side menu.
1. Enter the name of a specific data source in the search dialog. You can filter by **Data source** to only see data sources.
1. Click the data source you want to add.
1. Configure the data source following instructions specific to that data source.

## Query editors

Each data source's **query editor** provides a customized user interface that helps you write queries that take advantage of its unique capabilities.
You use a data source's query editor when you create queries in [dashboard panels](ref:query-transform-data) or [Explore](ref:explore).

Because of the differences between query languages, each data source query editor looks and functions differently.
Depending on your data source, the query editor might provide auto-completion features, metric names, variable suggestions, or a visual query-building interface.

For general information about querying in Grafana, and common options and user interface elements across all query editors, refer to [Query and transform data](ref:query-transform-data).

## Provision data sources

You can define and manage data sources as code using Grafana's provisioning system. This lets you configure data sources through YAML files or Terraform instead of the Grafana UI, which is useful for automated deployments and version-controlled configuration.

For more information, refer to [Provision data sources](ref:provisioning-data-sources).

## Special data sources

Grafana includes three special data sources:

### Grafana

A built-in data source that generates random walk data and can poll the [Testdata](testdata/) data source. Additionally, it can list files and get other data from a Grafana installation. This can be helpful for testing visualizations and running experiments.

### Mixed

An abstraction that lets you query multiple data sources in the same panel. When you select Mixed, you can then select a different data source for each new query that you add.

- The first query uses the data source that was selected before you selected **Mixed**.
- You can't change an existing query to use the **Mixed** data source.

{{< docs/play title="Mixed Datasources Example" url="https://play.grafana.org/d/000000100/" >}}

### Dashboard

A data source that uses the result set from another panel in the same dashboard. The dashboard data source can use data either directly from the selected panel or from annotations attached to the selected panel.

{{< docs/play title="Panel as a Data Source" url="https://play.grafana.org/d/ede8zps8ndb0gc/" >}}

## Built-in core data sources

Grafana ships with the following core data sources, organized by their primary use case.

### Metrics and time series

- [AWS CloudWatch](aws-cloudwatch/)
- [Azure Monitor](azure-monitor/)
- [Google Cloud Monitoring](google-cloud-monitoring/)
- [Graphite](graphite/)
- [InfluxDB](influxdb/)
- [OpenTSDB](opentsdb/)
- [Prometheus](prometheus/)

### Logs

- [Elasticsearch](elasticsearch/)
- [Loki](loki/)

### Traces

- [Jaeger](jaeger/)
- [Tempo](tempo/)
- [Zipkin](zipkin/)

### Profiles

- [Parca](parca/)
- [Pyroscope](pyroscope/)

### SQL databases

- [Microsoft SQL Server (MSSQL)](mssql/)
- [MySQL](mysql/)
- [PostgreSQL](postgres/)

### Alerting

- [Alertmanager](alertmanager/)

### Testing and debugging

- [Testdata](testdata/)

## Add additional data source plugins

You can add additional data sources as plugins (that aren't available in core Grafana), which you can install or create yourself.

### Find data source plugins in the plugin catalog

To view available data source plugins, go to the [plugin catalog](/grafana/plugins/?type=datasource) and select the "Data sources" filter.
For details about the plugin catalog, refer to [Plugin management](ref:plugin-management).

You can further filter the plugin catalog's results for data sources provided by the Grafana community, Grafana Labs, and partners.
If you use [Grafana Enterprise](ref:grafana-enterprise), you can also filter by Enterprise-supported plugins.

For more documentation on a specific data source plugin's features, including its query language and editor, refer to its plugin catalog page.

### Create a data source plugin

To build your own data source plugin, refer to the [Build a data source plugin](/developers/plugin-tools/tutorials/build-a-data-source-plugin) tutorial and [Plugin tools](/developers/plugin-tools).

## Next steps

After you've configured a data source, you can:

- **Build a dashboard:** Click the **Build a dashboard** button on the data source configuration page, or refer to [Create a dashboard](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard/).
- **Explore your data:** Use [Explore](ref:explore) to run ad-hoc queries without creating a dashboard.
- **Set up alerts:** Create [alert rules](ref:alerts) to get notified when your data meets certain conditions.
- **Transform query results:** Apply [transformations](ref:query-transform-data) to manipulate and combine data from multiple sources.
