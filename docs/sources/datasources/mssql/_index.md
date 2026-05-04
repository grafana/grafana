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

# Microsoft SQL Server data source

Microsoft SQL Server (MSSQL) is one of the most widely used relational databases for business applications, analytics, and operational workloads. The built-in MSSQL data source lets you query your existing SQL Server instance directly from Grafana, no data migration or additional plugins required.

You can connect to Microsoft SQL Server 2012 or newer, Azure SQL Database, and Azure SQL Managed Instance.

## Supported features

| Feature     | Supported |
| ----------- | --------- |
| Metrics     | Yes       |
| Alerting    | Yes       |
| Annotations | Yes       |

## Supported versions

| Version                    | Supported |
| -------------------------- | --------- |
| Microsoft SQL Server 2012+ | Yes       |
| Azure SQL Database         | Yes       |
| Azure SQL Managed Instance | Yes       |

Grafana recommends using the latest available service pack for optimal compatibility.

## Authentication methods

The Microsoft SQL Server data source supports the following authentication methods:

| Method                                       | Best for                                 | Grafana Cloud |
| -------------------------------------------- | ---------------------------------------- | ------------- |
| SQL Server Authentication                    | Any deployment                           | Yes           |
| Windows Authentication (Integrated Security) | On-premise with Windows SSO              | No            |
| Windows AD (`Kerberos`)                      | Enterprise Active Directory environments | No            |
| Azure Entra ID (App Registration)            | Azure SQL with service principal         | Yes           |
| Azure Entra ID (Managed Identity)            | Grafana hosted in Azure                  | No            |
| Azure Entra ID (Current User)                | User-level access control with Azure SQL | Yes           |

For configuration details, refer to [Configure the Microsoft SQL Server data source](configure/).

## Get started

The following documentation helps you set up and use the Microsoft SQL Server data source:

- [Configure the data source](configure/)
- [Query editor](query-editor/)
- [Template variables](template-variables/)
- [Annotations](annotations/)
- [Alerting](alerting/)
- [Troubleshooting](troubleshooting/)

## Additional features

After you configure the data source, you can:

- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to query data without building a dashboard
- Create [visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/) including time series, tables, and gauges
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/) to manipulate query results
- Optimize performance with [query caching](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/#query-and-resource-caching) (Grafana Enterprise and Cloud)

## Related data sources

- [PostgreSQL](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/)
- [MySQL](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mysql/)
