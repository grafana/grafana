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
refs:
  configure-grafana-feature-toggles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  configure-grafana-azure-auth:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/azuread/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/azuread/
  build-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
  transform-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/
  configure-grafana-azure:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#azure
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#azure
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  configure-grafana-azure-auth-scopes:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/azuread/#enable-azure-ad-oauth-in-grafana
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/azuread/#enable-azure-ad-oauth-in-grafana
  configure-azure-monitor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/configure/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/configure/
  query-editor-azure-monitor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/query-editor/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/query-editor/
  template-variables-azure-monitor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/template-variables/
  alerting-azure-monitor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/alerting/
  troubleshooting-azure-monitor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/troubleshooting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/troubleshooting/
  annotations-azure-monitor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/annotations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/annotations/
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

- [Configure the Azure Monitor data source](ref:configure-azure-monitor) - Set up authentication and connect to Azure
- [Azure Monitor query editor](ref:query-editor-azure-monitor) - Create and edit queries for Metrics, Logs, Traces, and Resource Graph
- [Template variables](ref:template-variables-azure-monitor) - Create dynamic dashboards with Azure Monitor variables
- [Alerting](ref:alerting-azure-monitor) - Create alert rules using Azure Monitor data
- [Troubleshooting](ref:troubleshooting-azure-monitor) - Solve common configuration and query errors

## Additional features

After you have configured the Azure Monitor data source, you can:

- Add [Annotations](ref:annotations-azure-monitor) to overlay Azure log events on your graphs.
- Configure and use [Template variables](ref:template-variables-azure-monitor) for dynamic dashboards.
- Add [Transformations](ref:transform-data) to manipulate query results.
- Set up [Alerting](ref:alerting-azure-monitor) and recording rules using Metrics, Logs, Traces, and Resource Graph queries.
- Use [Explore](ref:explore) to investigate your Azure data without building a dashboard.

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
