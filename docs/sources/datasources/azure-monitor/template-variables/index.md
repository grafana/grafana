---
aliases:
  - ../../data-sources/azure-monitor/template-variables/
  - ../azuremonitor/template-variables/
description: Using template variables with Azure Monitor in Grafana
keywords:
  - grafana
  - microsoft
  - azure
  - monitor
  - application
  - insights
  - log
  - analytics
  - templates
  - variables
  - queries
menuTitle: Template variables
title: Azure Monitor template variables
weight: 400
---

# Azure Monitor template variables

Instead of hard-coding details such as resource group or resource name values in metric queries, you can use variables.
This helps you create more interactive, dynamic, and reusable dashboards.
Grafana refers to such variables as template variables.

For an introduction to templating and template variables, refer to the [Templating]({{< relref "../../../dashboards/variables" >}}) and [Add and manage variables]({{< relref "../../../dashboards/variables/add-template-variables" >}}) documentation.

## Use query variables

You can specify these Azure Monitor data source queries in the Variable edit view's **Query Type** field.

| Name                | Description                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Subscriptions**   | Returns subscriptions.                                                                                             |
| **Resource Groups** | Returns resource groups for a specified. Supports multi-value. subscription.                                       |
| **Namespaces**      | Returns metric namespaces for the specified subscription and resource group.                                       |
| **Regions**         | Returns regions for the specified subscription                                                                     |
| **Resource Names**  | Returns a list of resource names for a specified subscription, resource group and namespace. Supports multi-value. |
| **Metric Names**    | Returns a list of metric names for a resource.                                                                     |
| **Workspaces**      | Returns a list of workspaces for the specified subscription.                                                       |
| **Logs**            | Use a KQL query to return values.                                                                                  |
| **Resource Graph**  | Use an ARG query to return values.                                                                                 |

Any Log Analytics Kusto Query Language (KQL) query that returns a single list of values can also be used in the Query field.
For example:

| Query                                                                                     | List of values returned                 |
| ----------------------------------------------------------------------------------------- | --------------------------------------- |
| `workspace("myWorkspace").Heartbeat \| distinct Computer`                                 | Virtual machines                        |
| `workspace("$workspace").Heartbeat \| distinct Computer`                                  | Virtual machines with template variable |
| `workspace("$workspace").Perf \| distinct ObjectName`                                     | Objects from the Perf table             |
| `workspace("$workspace").Perf \| where ObjectName == "$object"` `\| distinct CounterName` | Metric names from the Perf table        |

### Query variable example

This time series query uses query variables:

```kusto
Perf
| where ObjectName == "$object" and CounterName == "$metric"
| where TimeGenerated >= $__timeFrom() and TimeGenerated <= $__timeTo()
| where  $__contains(Computer, $computer)
| summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer
| order by TimeGenerated asc
```

### Multi-value variables

It is possible to select multiple values for **Resource Groups** and **Resource Names** and use a single metrics query pointing to those values as long as they:

- Belong to the same subscription.
- Are in the same region.
- Are of the same type (namespace).

Also, note that if a template variable pointing to multiple resource groups or names is used in another template variable as a parameter (e.g. to retrieve metric names), only the first value will be used. This means that the combination of the first resource group and name selected should be valid.
