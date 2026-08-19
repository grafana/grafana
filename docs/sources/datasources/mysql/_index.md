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
review_date: 2026-08-10
---

# MySQL data source

The MySQL data source lets you query and visualize data from MySQL and MySQL-compatible databases like [MariaDB](https://mariadb.org/) or [Percona Server](https://www.percona.com/).
Use it to create dashboards, explore SQL data, and monitor MySQL-based workloads in real time.

The data source ships with Grafana out of the box. It's preinstalled in both Grafana OSS and Grafana Enterprise, so there's nothing for you to install. Starting with Grafana 13.2, it's packaged as a standalone plugin that updates independently of Grafana releases. Refer to [Plugin updates](#plugin-updates) for details.

Watch the following video to learn more about using the Grafana MySQL data source plugin: {{< youtube id="p_RDHfHS-P8">}}

{{< docs/play title="MySQL Overview" url="https://play.grafana.org/d/edyh1ib7db6rkb/mysql-overview" >}}

## Supported databases

This data source supports the following MySQL-compatible databases:

- MySQL 5.7 and newer
- MariaDB 10.5 and newer
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

## Plugin updates

Starting with Grafana 13.2, the MySQL data source is a standalone plugin, preinstalled in both Grafana OSS and Grafana Enterprise. This enables more frequent updates independent of Grafana releases. Grafana automatically checks the plugin catalog and installs the latest version on each server restart.

To adjust this behavior:

- **Opt out of auto-updates:** Set `preinstall_auto_update` to `false` in your [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/).
- **Update manually:** Update at any time from the **Administration > Plugins** page without restarting Grafana.

The standalone plugin requires Grafana 12.3.0 or later. The MySQL data source bundled with Grafana 13.1 and earlier continues to work as before. These versions are unaffected by the change.

Users running Grafana 12.3.x through 13.1.x can install the standalone plugin from the plugin catalog if they want the latest features before upgrading to Grafana 13.2. To use the standalone plugin with Grafana 12.3.x through 13.1.x, add the following to your [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/):

```ini
[plugin.mysql]
as_external = true

[plugins]
; Install the latest version on startup:
preinstall_sync = mysql
; Or install a specific version:
; preinstall_sync = mysql@<version>
```

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
