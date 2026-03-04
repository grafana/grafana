---
aliases:
  - ../data-sources/mssql/
  - ../features/datasources/mssql/
description: Guide for using Microsoft SQL Server in Grafana
keywords:
  - grafana
  - MSSQL
  - Microsoft
  - SQL
  - guide
  - Azure SQL Database
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Microsoft SQL Server
title: Microsoft SQL Server data source
weight: 900
---

# Microsoft SQL Server (MSSQL) data source

Grafana ships with built-in support for Microsoft SQL Server (MSSQL).
You can query and visualize data from any Microsoft SQL Server 2005 or newer, including Microsoft Azure SQL Database.

Use this data source to create dashboards, explore SQL data, and monitor MSSQL-based workloads in real time.

The following documentation helps you get started working with the Microsoft SQL Server (MSSQL) data source:

- [Configure the Microsoft SQL Server data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/configure/)
- [Microsoft SQL Server query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/query-editor/)
- [Microsoft SQL Server template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/template-variables/)
- [Troubleshoot Microsoft SQL Server data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/troubleshooting/)

## Supported versions

This data source supports the following Microsoft SQL Server versions:

- Microsoft SQL Server 2005 and newer
- Microsoft Azure SQL Database
- Azure SQL Managed Instance

Grafana recommends using the latest available service pack for your SQL Server version for optimal compatibility.

## Key capabilities

The Microsoft SQL Server data source supports:

- **Time series queries:** Visualize metrics over time using the built-in time grouping macros.
- **Table queries:** Display query results in table format for any valid SQL query.
- **Template variables:** Create dynamic dashboards with variable-driven queries.
- **Annotations:** Overlay events from SQL Server on your dashboard graphs.
- **Alerting:** Create alerts based on SQL Server query results.
- **Stored procedures:** Execute stored procedures and visualize results.
- **Macros:** Simplify queries with built-in macros for time filtering and grouping.

## Additional resources

After configuring the Microsoft SQL Server data source, you can:

- Create a wide variety of [visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/)
- Configure and use [templates and variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/)
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/)
- Add [annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/)
- Set up [alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/)
- Optimize performance with [query caching](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/#query-and-resource-caching)

## Related data sources

- [PostgreSQL](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/) - For PostgreSQL databases.
- [MySQL](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mysql/) - For MySQL and MariaDB databases.
