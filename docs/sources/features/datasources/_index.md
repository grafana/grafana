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
* [Google Stackdriver]({{< relref "stackdriver.md" >}})
* [Graphite]({{< relref "graphite.md" >}})
* [InfluxDB]({{< relref "influxdb.md" >}})
* [Loki]({{< relref "loki.md" >}})
* [Microsoft SQL Server (MSSQL)]({{< relref "mssql.md" >}})
* [Mixed]({{< relref "mixed.md" >}})
* [MySQL]({{< relref "mysql.md" >}})
* [OpenTSDB]({{< relref "opentsdb.md" >}})
* [PostgreSQL]({{< relref "postgres.md" >}})
* [Prometheus]({{< relref "prometheus.md" >}})
* [Testdata]({{< relref "testdata.md" >}})

## Data source plugins

Since Grafana 3.0 you can install data sources as plugins. Check out [Grafana.net](https://grafana.com/plugins) for more data sources.
