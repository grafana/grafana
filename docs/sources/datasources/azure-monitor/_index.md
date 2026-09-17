---
aliases:
  - ../data-sources/azure-monitor/
  - ../features/datasources/azuremonitor/
  - azuremonitor/
description: Guide for using Azure Monitor in Grafana
keywords:
  - grafana
  - microsoft
  - azure
  - monitor
  - application
  - insights
  - log
  - analytics
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Azure Monitor
title: Azure Monitor data source
weight: 300
review_date: 2026-05-12
---

# Azure Monitor data source

The Azure Monitor data source plugin allows you to query and visualize data from Azure Monitor, the Azure service to maximize the availability and performance of applications and services in the Azure Cloud.

## Supported features

| Feature     | Supported |
| ----------- | --------- |
| Metrics     | Yes       |
| Logs        | Yes       |
| Traces      | Yes       |
| Alerting    | Yes       |
| Annotations | Yes       |

{{< admonition type="note" >}}
The Azure Monitor data source requires Grafana 12.3 or later.
{{< /admonition >}}

## Supported Azure clouds

The Azure Monitor data source supports the following Azure cloud environments:

- **Azure** - Azure public cloud (default)
- **Azure US Government** - Azure Government cloud
- **Azure China** - Azure China cloud operated by 21Vianet

## Supported Azure services

The Azure Monitor data source supports the following Azure services:

| Service                         | Description                                                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Azure Monitor Metrics**       | Collect numeric data from resources in your Azure account. Supports dimensions, aggregations, and time grain configuration. |
| **Azure Monitor Logs**          | Collect log and performance data from your Azure account using the Kusto Query Language (KQL).                              |
| **Azure Resource Graph**        | Query your Azure resources across subscriptions using KQL. Useful for inventory, compliance, and resource management.       |
| **Application Insights Traces** | Collect distributed trace data and correlate requests across your application components.                                   |

## Get started

The following documents help you get started with the Azure Monitor data source:

- [Configure the Azure Monitor data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/configure/) - Set up authentication and connect to Azure
- [Azure Monitor query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/query-editor/) - Create and edit queries for Metrics, Logs, Traces, and Resource Graph
- [Template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/template-variables/) - Create dynamic dashboards with Azure Monitor variables
- [Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/alerting/) - Create alert rules using Azure Monitor data
- [Troubleshooting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/troubleshooting/) - Solve common configuration and query errors

## Additional features

After you have configured the Azure Monitor data source, you can:

- Add [Annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/annotations/) to overlay Azure log events on your graphs.
- Configure and use [Template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/template-variables/) for dynamic dashboards.
- Add [Transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/) to manipulate query results.
- Set up [Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/alerting/) and recording rules using Metrics, Logs, Traces, and Resource Graph queries.
- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to investigate your Azure data without building a dashboard.

## Pre-built dashboards

The Azure Monitor plugin includes pre-built dashboards organized by category:

**Infrastructure monitoring:**

- Azure / Infrastructure / Apps Monitoring
- Azure / Infrastructure / Compute Monitoring
- Azure / Infrastructure / Data Monitoring
- Azure / Infrastructure / Network Monitoring
- Azure / Infrastructure / Storage and Key Vaults Monitoring

**Azure Insights:**

- Azure / Insights / Applications
- Azure / Insights / Applications / Performance / Operations
- Azure / Insights / Applications / Performance / Dependencies
- Azure / Insights / Applications / Failures / Operations
- Azure / Insights / Applications / Failures / Dependencies
- Azure / Insights / Applications / Failures / Exceptions
- Azure / Insights / Applications Test Availability Geo Map
- Azure / Insights / CosmosDB
- Azure / Insights / Data Explorer Clusters
- Azure / Insights / Key Vaults
- Azure / Insights / Networks
- Azure / Insights / SQL Database
- Azure / Insights / Storage Accounts
- Azure / Insights / Virtual Machines by Resource Group
- Azure / Insights / Virtual Machines by Workspace

**Other:**

- Azure / Alert Consumption
- Azure / Azure PostgreSQL / Flexible Server Monitoring
- Azure Monitor / Container Insights / Syslog
- Azure / Resources Overview

To import a pre-built dashboard:

1. Go to **Connections** > **Data sources**.
1. Select your Azure Monitor data source.
1. Click the **Dashboards** tab.
1. Click **Import** next to the dashboard you want to use.

## Plugin updates

Always ensure that your plugin version is up-to-date so you have access to all current features and improvements. Navigate to **Plugins and data** > **Plugins** to check for updates. Grafana recommends upgrading to the latest Grafana version, and this applies to plugins as well.

{{< admonition type="note" >}}
Plugins are automatically updated in Grafana Cloud.
{{< /admonition >}}

## Related resources

- [Azure Monitor documentation](https://learn.microsoft.com/en-us/azure/azure-monitor/)
- [Kusto Query Language (KQL) reference](https://learn.microsoft.com/en-us/azure/data-explorer/kusto/query/)
- [Grafana community forum](https://community.grafana.com/)
