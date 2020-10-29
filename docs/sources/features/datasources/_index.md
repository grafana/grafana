+++
title = "Data Sources"
type = "docs"
aliases = ["/docs/grafana/latest/datasources/overview/"]
[menu.docs]
name = "Data Sources"
identifier = "datasources"
parent = "features"
weight = 5
+++

# Data Source Overview

Grafana supports many different storage backends for your time series data (data source). Each data source has a specific Query Editor that is customized for the features and capabilities that the particular data source exposes.

## Querying

The query language and capabilities of each data source are obviously very different. You can combine data from multiple data sources onto a single Dashboard, but each Panel is tied to a specific data source that belongs to a particular Organization.

## Supported data sources

The following data sources are officially supported:

* [AWS CloudWatch]({{< relref "cloudwatch.md" >}})
* [Azure Monitor]({{< relref "azuremonitor.md" >}})
* [Elasticsearch]({{< relref "elasticsearch.md" >}})
* [Google Cloud Monitoring]({{< relref "cloudmonitoring.md" >}})
* [Graphite]({{< relref "graphite.md" >}})
* [InfluxDB]({{< relref "influxdb.md" >}})
* [Loki]({{< relref "loki.md" >}})
* [Microsoft SQL Server (MSSQL)]({{< relref "mssql.md" >}})
* [MySQL]({{< relref "mysql.md" >}})
* [OpenTSDB]({{< relref "opentsdb.md" >}})
* [PostgreSQL]({{< relref "postgres.md" >}})
* [Prometheus]({{< relref "prometheus.md" >}})
* [Testdata]({{< relref "testdata.md" >}})

In addition to the data sources that you have configured in your Grafana, there are three special data sources available:

- **Grafana -** A built-in data source that generates random walk data. Useful for testing visualizations and running experiments.
- **Mixed -** Select this to query multiple data sources in the same panel. When this data source is selected, Grafana allows you to select a data source for every new query that you add.
  * The first query will use the data source that was selected before you selected **Mixed**.
  * You cannot change an existing query to use the Mixed Data Source.
  * Grafana Play example: [Mixed data sources](https://play.grafana.org/d/000000100/mixed-datasources?orgId=1)
- **Dashboard -** Select this to use a result set from another panel in the same dashboard.

## Data source plugins

Since Grafana 3.0 you can install data sources as plugins. Check out [Grafana.com/plugins](https://grafana.com/plugins) for more data sources.
