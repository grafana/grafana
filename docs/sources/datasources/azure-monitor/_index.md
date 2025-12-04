---
aliases:
  - ../data-sources/azure-monitor/
  - ../features/datasources/azuremonitor/
  - azuremonitor/
  - azuremonitor/deprecated-application-insights/
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
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/azuread/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/azuread/
  build-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
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
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/azuread/#enable-azure-ad-oauth-in-grafana
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/azuread/#enable-azure-ad-oauth-in-grafana
---

# Azure Monitor data source

The Azure Monitor data source plugin allows you to query and visualize data from Azure Monitor, the Azure service to maximize the availability and performance of applications and services in the Azure Cloud. This is a core Grafana plugin that ships with Grafana and requires no additional installation.

## Supported Azure services

The Azure Monitor data source supports the following Azure services:

| Service | Description |
|---------|-------------|
| **Azure Monitor Metrics** | Collect numeric data from resources in your Azure account. Supports dimensions, aggregations, and time grain configuration. |
| **Azure Monitor Logs** | Collect log and performance data from your Azure account using the Kusto Query Language (KQL). |
| **Azure Resource Graph** | Query your Azure resources across subscriptions using KQL. Useful for inventory, compliance, and resource management. |
| **Application Insights Traces** | Collect distributed trace data and correlate requests across your application components. |

## Get started

The following documents will help you get started with the Azure Monitor data source:

| Topic | Description |
|-------|-------------|
| [Configure the Azure Monitor data source](configure/) | Set up authentication and connect to Azure |
| [Azure Monitor query editor](query-editor/) | Create and edit queries for Metrics, Logs, Traces, and Resource Graph |
| [Template variables](template-variables/) | Create dynamic dashboards with Azure Monitor variables |
| [Troubleshoot](troubleshoot/) | Solve common configuration and query errors |

## Additional features

Once you have configured the Azure Monitor data source, you can:

- Add [Annotations](annotations/) to overlay Azure log events on your graphs.
- Configure and use [Template variables](template-variables/) for dynamic dashboards.
- Add [Transformations](ref:build-dashboards) to manipulate query results.
- Set up alerting and recording rules using Metrics and Logs queries.
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

## Application Insights and Insights Analytics (removed)

Until Grafana v8.0, you could query the same Azure Application Insights data using Application Insights and Insights Analytics.

These queries were deprecated in Grafana v7.5. In Grafana v8.0, Application Insights and Insights Analytics were made read-only in favor of querying this data through Metrics and Logs. These query methods were completely removed in Grafana v9.0.

If you're upgrading from a Grafana version prior to v9.0 and relied on Application Insights and Analytics queries, refer to the [Grafana v9.0 documentation](/docs/grafana/v9.0/datasources/azuremonitor/deprecated-application-insights/) for help migrating these queries to Metrics and Logs queries.
