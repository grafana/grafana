---
aliases:
  - data-sources/
  - overview/
  - ./features/datasources/
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Data sources
weight: 60
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
    - pattern: /docs/grafana-cloud
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/plugin-management/
  panels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/
---

# Grafana data sources

Grafana comes with built-in support for many _data sources_.
If you need other data sources, you can also install one of the many data source plugins.
If the plugin you need doesn't exist, you can develop a custom plugin.

{{< youtube id="cqHO0oYW6Ic" >}}

Each data source comes with a _query editor_,
which formulates custom queries according to the source's structure.
After you add and configure a data source, you can use it as an input for many operations, including:

- Query the data with [Explore](ref:explore).
- Visualize it in [panels](ref:panels).
- Create rules for [alerts](ref:alerts).

This documentation describes how to manage data sources in general,
and how to configure or query the built-in data sources.
For other data sources, refer to the list of [datasource plugins](/grafana/plugins/).

To develop a custom plugin, refer to [Create a data source plugin](#create-a-data-source-plugin).

## Manage data sources

Only users with the [organization administrator role](ref:organization-roles) can add or remove data sources.
To access data source management tools in Grafana as an administrator, navigate to **Configuration > Data Sources** in the Grafana sidebar.

For details on data source management, including instructions on how configure user permissions for queries, refer to the [administration documentation](ref:data-source-management).

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

## Use query editors

{{< figure src="/static/img/docs/queries/influxdb-query-editor-7-2.png" class="docs-image--no-shadow" max-width="1000px" caption="The InfluxDB query editor" >}}

Each data source's **query editor** provides a customized user interface that helps you write queries that take advantage of its unique capabilities.
You use a data source's query editor when you create queries in [dashboard panels](ref:query-transform-data) or [Explore](ref:explore).

Because of the differences between query languages, each data source query editor looks and functions differently.
Depending on your data source, the query editor might provide auto-completion features, metric names, variable suggestions, or a visual query-building interface.

For example, this video demonstrates the visual Prometheus query builder:

{{< vimeo 720004179 >}}

For general information about querying in Grafana, and common options and user interface elements across all query editors, refer to [Query and transform data](ref:query-transform-data).

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

These built-in core data sources are also included in the Grafana documentation:

{{< column-list >}}

- [Alertmanager](alertmanager/)
- [AWS CloudWatch](aws-cloudwatch/)
- [Azure Monitor](azure-monitor/)
- [Elasticsearch](elasticsearch/)
- [Google Cloud Monitoring](google-cloud-monitoring/)
- [Graphite](graphite/)
- [InfluxDB](influxdb/)
- [Jaeger](jaeger/)
- [Loki](loki/)
- [Microsoft SQL Server (MSSQL)](mssql/)
- [MySQL](mysql/)
- [OpenTSDB](opentsdb/)
- [PostgreSQL](postgres/)
- [Prometheus](prometheus/)
- [Pyroscope](pyroscope/)
- [Tempo](tempo/)
- [Testdata](testdata/)
- [Zipkin](zipkin/)

{{< /column-list >}}

## Add additional data source plugins

You can add additional data sources as plugins (that are not available in core Grafana), which you can install or create yourself.

### Find data source plugins in the plugin catalog

To view available data source plugins, go to the [plugin catalog](/grafana/plugins/?type=datasource) and select the "Data sources" filter.
For details about the plugin catalog, refer to [Plugin management](ref:plugin-management).

You can further filter the plugin catalog's results for data sources provided by the Grafana community, Grafana Labs, and partners.
If you use [Grafana Enterprise](ref:grafana-enterprise), you can also filter by Enterprise-supported plugins.

For more documentation on a specific data source plugin's features, including its query language and editor, refer to its plugin catalog page.

### Create a data source plugin

To build your own data source plugin, refer to the [Build a data source plugin](/developers/plugin-tools/tutorials/build-a-data-source-plugin) tutorial and [Plugin tools](/developers/plugin-tools).
