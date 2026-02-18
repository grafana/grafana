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
last_reviewed: 2025-12-04
---

# Azure Monitor data source

The Azure Monitor data source plugin allows you to query and visualize data from Azure Monitor, the Azure service to maximize the availability and performance of applications and services in the Azure Cloud.

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

The following documents will help you get started with the Azure Monitor data source:

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

The Azure Monitor plugin includes the following pre-built dashboards:

- **Azure Monitor Overview** - Displays key metrics across your Azure subscriptions and resources.
- **Azure Storage Account** - Shows storage account metrics including availability, latency, and transactions.

To import a pre-built dashboard:

1. Go to **Connections** > **Data sources**.
1. Select your Azure Monitor data source.
1. Click the **Dashboards** tab.
1. Click **Import** next to the dashboard you want to use.

## Related resources

- [Azure Monitor documentation](https://docs.microsoft.com/en-us/azure/azure-monitor/)
- [Kusto Query Language (KQL) reference](https://docs.microsoft.com/en-us/azure/data-explorer/kusto/query/)
- [Grafana community forum](https://community.grafana.com/)
