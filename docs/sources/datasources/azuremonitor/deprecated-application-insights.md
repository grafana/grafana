---
description: Template to provision the Azure Monitor data source
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
title: Application Insights deprecation
weight: 999
---

# Deprecated Application Insights and Insights Analytics

Application Insights and Insights Analytics are two ways to query the same Azure Application Insights data, which can also be queried from Metrics and Logs. In Grafana 8.0, Application Insights and Insights Analytics are deprecated and made read-only in favor of querying this data through Metrics and Logs. Existing queries will continue to work, but you cannot edit them. New panels are not able to use Application Insights or Insights Analytics.

Azure Monitor Metrics and Azure Monitor Logs do not use Application Insights API keys, so make sure the data source is configured with an Azure AD app registration that has access to Application Insights.

## Application Insights

New Application Insights queries can be made with the Metrics service and selecting the "Application Insights" resource type. Application Insights has metrics available between two different metric

{{< figure src="/static/img/docs/azure-monitor/app-insights-metrics.png" max-width="800px" class="docs-image--no-shadow" caption="Azure Monitor Application Insights example" >}}

## Insights Analytics

New Insights Analaytics queries can be written with Kusto in the Logs query type by selecting your Application Insights resource.

{{< figure src="/static/img/docs/azure-monitor/app-insights-logs.png" max-width="800px" class="docs-image--no-shadow" caption="Azure Logs Application Insights example" >}}

The new resource picker for Logs shows all resources on your Azure subscription compatible with Logs.

{{< figure src="/static/img/docs/azure-monitor/app-insights-resource-picker.png" max-width="800px" class="docs-image--no-shadow" caption="Azure Logs Application Insights resource picker" >}}
