---
aliases:
  - ../data-sources/mysql/
  - ../features/datasources/mysql/
description: Introduction to the MySQL data source in Grafana
keywords:
  - grafana
  - mysql
  - data source
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: MySQL
title: MySQL data source
weight: 1000
---

# MySQL data source

Grafana ships with built-in support for MySQL.
You can query and visualize data from MySQL-compatible databases like [MariaDB](https://mariadb.org/) or [Percona Server](https://www.percona.com/).

Use this data source to create dashboards, explore SQL data, and monitor MySQL-based workloads in real time.

Watch this video to learn more about using the Grafana MySQL data source plugin: {{< youtube id="p_RDHfHS-P8">}}

{{< docs/play title="MySQL Overview" url="https://play.grafana.org/d/edyh1ib7db6rkb/mysql-overview" >}}

## Supported databases

This data source supports the following MySQL-compatible databases:

- MySQL 5.7 and newer
- MariaDB 10.2 and newer
- Percona Server 5.7 and newer
- Amazon Aurora MySQL
- Azure Database for MySQL
- Google Cloud SQL for MySQL

Grafana recommends using the latest available version for your database for optimal compatibility.

## Key capabilities

The MySQL data source supports:

- **Time series queries:** Visualize metrics over time using built-in time grouping macros.
- **Table queries:** Display query results in table format for any valid SQL query.
- **Template variables:** Create dynamic dashboards with variable-driven queries.
- **Annotations:** Overlay events from MySQL on your dashboard graphs.
- **Alerting:** Create alerts based on MySQL query results.
- **Macros:** Simplify queries with built-in macros for time filtering and grouping.

## Get started

The following documentation helps you get started with the MySQL data source:

- [Configure the MySQL data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mysql/configure/)
- [MySQL query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mysql/query-editor/)
- [MySQL template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mysql/template-variables/)
- [MySQL annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mysql/annotations/)
- [MySQL alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mysql/alerting/)
- [Troubleshoot MySQL data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mysql/troubleshooting/)

## Additional resources

After configuring the MySQL data source, you can also:

- Create a wide variety of [visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/).
- Configure and use [templates and variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/).
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/).
- Optimize performance with [query caching](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/#query-and-resource-caching).

## Pre-configured dashboards

If you want to monitor your MySQL server's performance metrics (connections, queries, replication, and more), Grafana provides pre-configured dashboards through the MySQL integration:

- **MySQL Overview** - Key performance metrics for your MySQL server.
- **MySQL Logs** - Log analysis for troubleshooting.

The MySQL integration uses the Prometheus MySQL Exporter to collect server metrics and includes 15 pre-configured alert rules.

To use these dashboards:

1. In Grafana Cloud, navigate to **Connections** > **Add new connection**.
1. Search for **MySQL** and select the MySQL integration.
1. Follow the setup instructions to install the MySQL Exporter.
1. Import the pre-configured dashboards from the integration page.

For more MySQL dashboards, browse the [Grafana dashboard catalog](https://grafana.com/grafana/dashboards/?search=mysql).

{{< admonition type="note" >}}
The MySQL integration monitors your MySQL _server_ using Prometheus metrics. The MySQL _data source_ documented here queries data stored _in_ MySQL tables. These are complementary features for different use cases.
{{< /admonition >}}

## Related data sources

- [PostgreSQL](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/) - For PostgreSQL databases.
- [Microsoft SQL Server](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/) - For Microsoft SQL Server and Azure SQL databases.
