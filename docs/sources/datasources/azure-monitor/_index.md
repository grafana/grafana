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

Grafana ships with built-in support for Azure Monitor, the Azure service to maximize the availability and performance of applications and services in the Azure Cloud.
This topic explains configuring and querying specific to the Azure Monitor data source.

For instructions on how to add a data source to Grafana, refer to the [administration documentation](ref:data-source-management).
Only users with the organization administrator role can add data sources.

Once you've added the Azure Monitor data source, you can [configure it](configure/) so that your Grafana instance's users can create queries in its [query editor](query-editor/) when they [build dashboards](ref:build-dashboards) and use [Explore](ref:explore).

The Azure Monitor data source supports visualizing data from four Azure services:

- **Azure Monitor Metrics:** Collect numeric data from resources in your Azure account.
- **Azure Monitor Logs:** Collect log and performance data from your Azure account, and query using the Kusto Query Language (KQL).
- **Azure Resource Graph:** Query your Azure resources across subscriptions.
- **Azure Monitor Application Insights:** Collect trace logging data and other application performance metrics.

## Documentation

| Topic | Description |
|-------|-------------|
| [Configure](configure/) | Set up authentication and connect to Azure |
| [Query editor](query-editor/) | Build queries for Metrics, Logs, Traces, and Resource Graph |
| [Template variables](template-variables/) | Create dynamic dashboards with Azure Monitor variables |
| [Troubleshoot](troubleshoot/) | Solve common configuration and query errors |

## Application Insights and Insights Analytics (removed)

Until Grafana v8.0, you could query the same Azure Application Insights data using Application Insights and Insights Analytics.

These queries were deprecated in Grafana v7.5. In Grafana v8.0, Application Insights and Insights Analytics were made read-only in favor of querying this data through Metrics and Logs. These query methods were completely removed in Grafana v9.0.

If you're upgrading from a Grafana version prior to v9.0 and relied on Application Insights and Analytics queries, refer to the [Grafana v9.0 documentation](/docs/grafana/v9.0/datasources/azuremonitor/deprecated-application-insights/) for help migrating these queries to Metrics and Logs queries.
