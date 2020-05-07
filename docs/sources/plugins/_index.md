+++
title = "Plugins"
type = "docs"
[menu.docs]
name = "Plugins"
identifier = "plugins"
weight = 1
+++

# Plugins

Besides the wide range of visualizations and data sources that are available immediately after you install Grafana, you can extend your Grafana experience with _plugins_.

You can [install]({{< relref "./installation.md" >}}) one of the plugins built by the Grafana community, or [build one yourself]({{< relref "../developers/plugins/_index.md" >}}).

Grafana supports three types of plugins: [panels](https://grafana.com/grafana/plugins?type=panel), [data sources](https://grafana.com/grafana/plugins?type=datasource), and [apps](https://grafana.com/grafana/plugins?type=app).

## Panel plugins

Add new visualizations to your dashboard with panel plugins, such as the [Worldmap Panel](https://grafana.com/grafana/plugins/grafana-worldmap-panel), [Clock](https://grafana.com/grafana/plugins/grafana-clock-panel), and [Pie Chart](https://grafana.com/grafana/plugins/grafana-piechart-panel).

Use panel plugins when you want to:

- Visualize data returned by data source queries.
- Navigate between dashboards.
- Control external systems, such as smart home devices.

## Data source plugins

Data source plugins add support for new databases, such as [Google BigQuery](https://grafana.com/grafana/plugins/doitintl-bigquery-datasource).

Data source plugins communicate with external sources of data and return the data in a format that Grafana understands. By adding a data source plugin, you can immediately use the data in any of your existing dashboards.

Use data source plugins when you want to import data from external systems.

## App plugins

Applications, or _app plugins_, bundle data sources and panels to provide a cohesive experience, such as the [Zabbix](https://grafana.com/grafana/plugins/alexanderzobnin-zabbix-app) and [Kubernetes](https://grafana.com/grafana/plugins/grafana-kubernetes-app) apps.

Apps can also add custom pages for things like control panels.

Use app plugins when you want to create an custom out-of-the-box monitoring experience.

## Learn more

- [Install plugins]({{< relref "./installation.md" >}})
- Browse the available [Plugins](https://grafana.com/grafana/plugins)
