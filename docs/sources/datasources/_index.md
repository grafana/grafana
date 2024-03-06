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
---

# Grafana data sources

Grafana comes with built-in support for many _data sources_.
If you need other data sources, you can also install one of the many data source plugins.
If the plugin you need doesn't exist, you can develop a custom plugin.

{{< youtube id="cqHO0oYW6Ic" >}}

Each data source comes with a _query editor_,
which formulates custom queries according to the source's structure.
After you add and configure a data source, you can use it as an input for many operations, including:

- Query the data with [Explore][explore].
- Visualize it in [panels][panels].
- Create rules for [alerts][alerts].

This documentation describes how to manage data sources in general,
and how to configure or query the built-in data sources.
For other data sources, refer to the list of [datasource plugins](/grafana/plugins/).

To develop a custom plugin, refer to [Create a data source plugin](#create-a-data-source-plugin).

## Manage data sources

Only users with the [organization administrator role][organization-roles] can add or remove data sources.
To access data source management tools in Grafana as an administrator, navigate to **Configuration > Data Sources** in the Grafana sidebar.

For details on data source management, including instructions on how configure user permissions for queries, refer to the [administration documentation][data-source-management].

## Add a data source

Before you can create your first dashboard, you need to add your data source.

{{% admonition type="note" %}}
Only users with the organization admin role can add data sources.
{{% /admonition %}}

**To add a data source:**

1. Click **Connections** in the left-side menu.
1. Enter the name of a specific data source in the search dialog. You can filter by **Data source** to only see data sources.
1. Click the data source you want to add.
1. Configure the data source following instructions specific to that data source.

## Use query editors

{{< figure src="/static/img/docs/queries/influxdb-query-editor-7-2.png" class="docs-image--no-shadow" max-width="1000px" caption="The InfluxDB query editor" >}}

Each data source's **query editor** provides a customized user interface that helps you write queries that take advantage of its unique capabilities.
You use a data source's query editor when you create queries in [dashboard panels][query-transform-data] or [Explore][explore].

Because of the differences between query languages, each data source query editor looks and functions differently.
Depending on your data source, the query editor might provide auto-completion features, metric names, variable suggestions, or a visual query-building interface.

For example, this video demonstrates the visual Prometheus query builder:

{{< vimeo 720004179 >}}

For general information about querying in Grafana, and common options and user interface elements across all query editors, refer to [Query and transform data][query-transform-data].

## Special data sources

Grafana includes three special data sources:

- **Grafana:** A built-in data source that generates random walk data and can poll the [Testdata]({{< relref "./testdata/" >}}) data source. Additionally, it can list files and get other data from a Grafana installation. This can be helpful for testing visualizations and running experiments.
- **Mixed:** An abstraction that lets you query multiple data sources in the same panel.
  When you select Mixed, you can then select a different data source for each new query that you add.
  - The first query uses the data source that was selected before you selected **Mixed**.
  - You can't change an existing query to use the **Mixed** data source.
  - Grafana Play example: [Mixed data sources](https://play.grafana.org/d/000000100/mixed-datasources?orgId=1)
- **Dashboard:** A data source that uses the result set from another panel in the same dashboard. The dashboard data source can use data either directly from the selected panel or from annotations attached to the selected panel.
  - Grafana Play example: [Panel as Data source](https://play.grafana.org/d/ede8zps8ndb0gc/panel-as-data-source?orgId=1)

## Built-in core data sources

These built-in core data sources are also included in the Grafana documentation:

- [Alertmanager]({{< relref "./alertmanager" >}})
- [AWS CloudWatch]({{< relref "./aws-cloudwatch" >}})
- [Azure Monitor]({{< relref "./azure-monitor" >}})
- [Elasticsearch]({{< relref "./elasticsearch" >}})
- [Google Cloud Monitoring]({{< relref "./google-cloud-monitoring" >}})
- [Graphite]({{< relref "./graphite" >}})
- [InfluxDB]({{< relref "./influxdb" >}})
- [Jaeger]({{< relref "./jaeger" >}})
- [Loki]({{< relref "./loki" >}})
- [Microsoft SQL Server (MSSQL)]({{< relref "./mssql" >}})
- [MySQL]({{< relref "./mysql" >}})
- [OpenTSDB]({{< relref "./opentsdb" >}})
- [PostgreSQL]({{< relref "./postgres" >}})
- [Prometheus]({{< relref "./prometheus" >}})
- [Tempo]({{< relref "./tempo" >}})
- [Testdata]({{< relref "./testdata" >}})
- [Zipkin]({{< relref "./zipkin" >}})

## Add additional data source plugins

You can add additional data sources as plugins (that are not available in core Grafana), which you can install or create yourself.

### Find data source plugins in the plugin catalog

To view available data source plugins, go to the [plugin catalog](/grafana/plugins/?type=datasource) and select the "Data sources" filter.
For details about the plugin catalog, refer to [Plugin management][Plugin-management].

You can further filter the plugin catalog's results for data sources provided by the Grafana community, Grafana Labs, and partners.
If you use [Grafana Enterprise][Grafana-Enterprise], you can also filter by Enterprise-supported plugins.

For more documentation on a specific data source plugin's features, including its query language and editor, refer to its plugin catalog page.

### Create a data source plugin

To build your own data source plugin, refer to the [Build a data source plugin](/developers/plugin-tools/tutorials/build-a-data-source-plugin) tutorial and [Plugin tools](/developers/plugin-tools).

{{% docs/reference %}}
[alerts]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/alerting"
[alerts]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/alerting"

[data-source-management]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/data-source-management"
[data-source-management]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/administration/data-source-management"

[explore]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/explore"
[explore]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/explore"

[organization-roles]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/roles-and-permissions#organization-roles"
[organization-roles]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/administration/roles-and-permissions#organization-roles"

[panels]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations"
[panels]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations"

[query-transform-data]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/query-transform-data"
[query-transform-data]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/query-transform-data"

[Plugin-management]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/plugin-management"
[Plugin-management]: "/docs/grafana-cloud -> /docs/grafana/<GRAFANA VERSION>/administration/plugin-management"

[Grafana-Enterprise]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/introduction/grafana-enterprise"

{{% /docs/reference %}}
