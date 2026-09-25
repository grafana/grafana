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
review_date: 2026-08-10
title: Microsoft SQL Server data source
weight: 900
---

# Microsoft SQL Server data source

Microsoft SQL Server (MSSQL) is one of the most widely used relational databases for business applications, analytics, and operational workloads. The MSSQL data source lets you query your existing SQL Server instance directly from Grafana, with no data migration required.

The data source ships with Grafana out of the box. It's preinstalled in both Grafana OSS and Grafana Enterprise, so there's nothing for you to install. Starting with Grafana 13.2, it's packaged as a standalone plugin that updates independently of Grafana releases. Refer to [Plugin updates](#plugin-updates) for details.

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

<!-- vale Grafana.Spelling = NO -->

| Method                                       | Best for                                 | Grafana Cloud | Self-managed | Supports alerting |
| -------------------------------------------- | ---------------------------------------- | ------------- | ------------ | ----------------- |
| SQL Server Authentication                    | Any deployment                           | Yes           | Yes          | Yes               |
| Windows Authentication (Integrated Security) | On-premises with Windows SSO             | No            | Yes          | Yes               |
| Windows AD (Kerberos)                        | Enterprise Active Directory environments | No            | Yes          | Yes               |
| Azure Entra ID (App Registration)            | Azure SQL with service principal         | Yes           | Yes          | Yes               |
| Azure Entra ID (Managed Identity)            | Grafana hosted in Azure                  | No            | Yes          | Yes               |
| Azure Entra ID (Current User)                | User-level access control with Azure SQL | Yes           | Yes          | No                |

<!-- vale Grafana.Spelling = YES -->

{{< admonition type="note" >}}
Azure Entra ID (Current User) authentication doesn't support alerting, reporting, or recorded queries because these features run on the backend without a user session.
{{< /admonition >}}

For configuration details, refer to [Configure the Microsoft SQL Server data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/configure/).

## Get started

The following documentation helps you set up and use the Microsoft SQL Server data source:

- [Configure the data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/configure/)
- [Query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/query-editor/)
- [Template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/template-variables/)
- [Annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/annotations/)
- [Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/alerting/)
- [Troubleshooting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/troubleshooting/)

## Plugin updates

Starting with Grafana 13.2, the Microsoft SQL Server data source is a standalone plugin, preinstalled in both Grafana OSS and Grafana Enterprise. This enables more frequent updates independent of Grafana releases. Grafana automatically checks the plugin catalog and installs the latest version on each server restart.

To adjust this behavior:

- **Opt out of auto-updates:** Set `preinstall_auto_update` to `false` in your [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/).
- **Update manually:** Update at any time from the **Administration > Plugins** page without restarting Grafana.

The standalone plugin requires Grafana 12.3.0 or later. The Microsoft SQL Server data source bundled with Grafana 13.1 and earlier continues to work as before. These versions are unaffected by the change.

Users running Grafana 12.3.x through 13.1.x can install the standalone plugin from the plugin catalog if they want the latest features before upgrading to Grafana 13.2. To use the standalone plugin with Grafana 12.3.x through 13.1.x, add the following to your [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/):

```ini
[plugin.mssql]
as_external = true

[plugins]
; Install the latest version on startup:
preinstall_sync = mssql
; Or install a specific version:
; preinstall_sync = mssql@<version>
```

## Additional features

After you configure the data source, you can:

- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to query data without building a dashboard
- Create [visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/) including time series, tables, and gauges
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/) to manipulate query results
- Optimize performance with [query caching](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/#query-and-resource-caching) (Grafana Enterprise and Cloud)

## Related data sources

- [PostgreSQL](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/)
- [MySQL](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mysql/)
