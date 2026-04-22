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
  template-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
  query-caching:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/#query-and-resource-caching
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/#query-and-resource-caching
  annotate-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
  correlations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/correlations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/correlations/
  troubleshoot-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/troubleshooting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/troubleshooting/
---

# Data sources

A _data source_ in Grafana is a connection to a storage backend that holds your data, such as a Prometheus server, a Loki instance, a SQL database, or a cloud monitoring service. Grafana queries data sources to retrieve the stored data (e.g. metrics, logs, traces, and profiles) that it then visualizes in dashboards and Explore.

Grafana comes with built-in support for many data sources.
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

By default, any user in an organization can query any data source in that organization. With [Grafana Enterprise](ref:grafana-enterprise) or Grafana Cloud, you can configure **data source permissions** to restrict query, edit, and admin access to specific users, teams, or roles. Refer to the [data source management documentation](ref:data-source-management) for details.

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

You can mark one data source as the **Default** by toggling the option on its configuration page. The default data source is pre-selected when you create new panels, navigate to Explore, or create alert rules.

## Query editors

Each data source's **query editor** provides a customized user interface that helps you write queries that take advantage of its unique capabilities.
You use a data source's query editor when you create queries in [dashboard panels](ref:query-transform-data) or [Explore](ref:explore).

Because of the differences between query languages, each data source query editor looks and functions differently.
Depending on your data source, the query editor might provide auto-completion features, metric names, variable suggestions, or a visual query-building interface.

For general information about querying in Grafana, and common options and user interface elements across all query editors, refer to [Query and transform data](ref:query-transform-data).

## Provision data sources

You can define and manage data sources as code using the Grafana provisioning system. This lets you configure data sources through YAML files or Terraform instead of the Grafana UI, which is useful for automated deployments and version-controlled configuration.

For more information, refer to [Provision data sources](ref:provisioning-data-sources).

## Special data sources

Grafana includes three special data sources:

### Grafana

A built-in data source that generates random walk data and can poll the [TestData](testdata/) data source. Additionally, it can list files and get other data from a Grafana installation. This can be helpful for testing visualizations and running experiments.

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

- [TestData](testdata/)

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

## Correlate data across data sources

Grafana lets you link related data across different data sources so you can jump from one signal to another during investigations. For example, you can navigate from a trace span to related logs, or from a log line to metrics for the same service.

You can set up these links in two ways:

- **Data source configuration:** Tracing data sources like Tempo, Jaeger, and Zipkin include built-in settings for trace-to-logs, trace-to-metrics, and trace-to-profiles links.
- **Correlations:** A more flexible, general-purpose feature that lets you define rules to link data between any data sources. Refer to [Correlations](ref:correlations) for details.

## Troubleshoot data sources

If you run into issues with a data source, refer to [Troubleshoot data sources](ref:troubleshoot-data-sources) for solutions to common problems like connection errors, authentication failures, and empty query results.

Each built-in data source also has its own troubleshooting page with guidance specific to that data source.

## Next steps

After you've configured a data source, you can:

- **Build a dashboard:** Click the **Build a dashboard** button on the data source configuration page, or refer to [Create a dashboard](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard/).
- **Explore your data:** Use [Explore](ref:explore) to run free-form queries without creating a dashboard.
- **Set up alerts:** Create [alert rules](ref:alerts) to get notified when your data meets certain conditions.
- **Use template variables:** Create dynamic, reusable dashboards with [template variables](ref:template-variables).
- **Add annotations:** Overlay [annotations](ref:annotate-visualizations) on your graphs to mark events and correlate them with metrics.
- **Transform query results:** Apply [transformations](ref:query-transform-data) to manipulate and combine data from multiple sources.
- **Enable query caching:** Improve dashboard performance and reduce backend load with [query and resource caching](ref:query-caching) (available in Grafana Enterprise and Grafana Cloud).
