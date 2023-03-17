---
aliases:
  - data-sources/
  - overview/
cascade:
  labels:
    products:
      - cloud
      - enterprise
      - oss
title: Data sources
weight: 60
---

# Data sources

Grafana comes with built-in support for many _data sources_.
If you need other data sources, you can also install one of the many data source plugins.
If the plugin you need doesn't exist, you can develop a custom plugin.

Each data source comes with a _query editor_,
which formulates custom queries according to the source's structure.
After you add and configure a data source, you can use it as an input for many operations, including:

- Query the data with [Explore]({{< relref "../explore" >}}).
- Visualize it in [panels]({{< relref "../panels-visualizations" >}}).
- Create rules for [alerts]({{< relref "../alerting" >}}).

This documentation describes how to manage data sources in general,
and how to configure or query the built-in data sources.
For other data sources, refer to the list of [datasource plugins](/grafana/plugins/).
To develop a custom plugin, refer to [Build a plugin]({{< relref "../developers/plugins/" >}}).

## Manage data sources

Only users with the [organization administrator role]({{< relref "../administration/roles-and-permissions#organization-roles" >}}) can add or remove data sources.
To access data source management tools in Grafana as an administrator, navigate to **Configuration > Data Sources** in the Grafana sidebar.

For details on data source management, including instructions on how to add data sources and configure user permissions for queries, refer to the [administration documentation]({{< relref "../administration/data-source-management" >}}).

## Use query editors

{{< figure src="/static/img/docs/queries/influxdb-query-editor-7-2.png" class="docs-image--no-shadow" max-width="1000px" caption="The InfluxDB query editor" >}}

Each data source's **query editor** provides a customized user interface that helps you write queries that take advantage of its unique capabilities.
You use a data source's query editor when you create queries in [dashboard panels]({{< relref "../panels-visualizations/query-transform-data" >}}) or [Explore]({{< relref "../explore/" >}}).

Because of the differences between query languages, each data source query editor looks and functions differently.
Depending on your data source, the query editor might provide auto-completion features, metric names, variable suggestions, or a visual query-building interface.

For example, this video demonstrates the visual Prometheus query builder:

{{< vimeo 720004179 >}}

For general information about querying in Grafana, and common options and user interface elements across all query editors, refer to [Query and transform data]({{< relref "../panels-visualizations/query-transform-data/" >}}).

## Built-in core data sources

These built-in core data sources are included in the Grafana documentation:

- [Alertmanager]({{< relref "./alertmanager/" >}})
- [AWS CloudWatch]({{< relref "./aws-cloudwatch/" >}})
- [Azure Monitor]({{< relref "./azure-monitor/" >}})
- [Elasticsearch]({{< relref "./elasticsearch/" >}})
- [Google Cloud Monitoring]({{< relref "./google-cloud-monitoring/" >}})
- [Graphite]({{< relref "./graphite/" >}})
- [InfluxDB]({{< relref "./influxdb/" >}})
- [Jaeger]({{< relref "./jaeger/" >}})
- [Loki]({{< relref "./loki/" >}})
- [Microsoft SQL Server (MSSQL)]({{< relref "./mssql/" >}})
- [MySQL]({{< relref "./mysql/" >}})
- [OpenTSDB]({{< relref "./opentsdb/" >}})
- [PostgreSQL]({{< relref "./postgres/" >}})
- [Prometheus]({{< relref "./prometheus/" >}})
- [Tempo]({{< relref "./tempo/" >}})
- [Testdata]({{< relref "./testdata/" >}})
- [Zipkin]({{< relref "./zipkin/" >}})

## Special data sources

Grafana also includes three special data sources:

- **Grafana:** A built-in data source that generates random walk data and can poll the [Testdata]({{< relref "./testdata/" >}}) data source.
  This helps you test visualizations and run experiments.
- **Mixed:** An abstraction that lets you query multiple data sources in the same panel.
  When you select Mixed, you can then select a different data source for each new query that you add.
  - The first query uses the data source that was selected before you selected **Mixed**.
  - You can't change an existing query to use the Mixed data source.
  - Grafana Play example: [Mixed data sources](https://play.grafana.org/d/000000100/mixed-datasources?orgId=1)
- **Dashboard:** A data source that uses the result set from another panel in the same dashboard.
