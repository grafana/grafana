---
aliases:
  - /docs/grafana/latest/datasources/azuremonitor/template-variables/
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
  - guide
title: Azure Monitor template variables
weight: 2
---

# Template variables

Instead of hard-coding values for fields like resource group or resource name in your queries, you can use variables in their place to create more interactive, dynamic, and reusable dashboards.

Check out the [Templating]({{< relref "../../variables/" >}}) documentation for an introduction to the templating feature and the different
types of template variables.

The Azure Monitor data source provides the following queries you can specify in the Query field in the Variable edit view

| Name            | Description                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------- |
| Subscriptions   | Returns subscriptions.                                                                       |
| Resource Groups | Returns resource groups for a specified subscription.                                        |
| Namespaces      | Returns metric namespaces for the specified subscription and resource group.                 |
| Resource Names  | Returns a list of resource names for a specified subscription, resource group and namespace. |
| Metric Names    | Returns a list of metric names for a resource.                                               |
| Workspaces      | Returns a list of workspaces for the specified subscription.                                 |
| Logs            | Use a KQL query to return values.                                                            |
| Resource Graph  | Use an ARG query to return values.                                                           |

Any Log Analytics KQL query that returns a single list of values can also be used in the Query field. For example:

| Query                                                                                     | Description                                               |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `workspace("myWorkspace").Heartbeat \| distinct Computer`                                 | Returns a list of Virtual Machines                        |
| `workspace("$workspace").Heartbeat \| distinct Computer`                                  | Returns a list of Virtual Machines with template variable |
| `workspace("$workspace").Perf \| distinct ObjectName`                                     | Returns a list of objects from the Perf table             |
| `workspace("$workspace").Perf \| where ObjectName == "$object"` `\| distinct CounterName` | Returns a list of metric names from the Perf table        |

Example of a time series query using variables:

```kusto
Perf
| where ObjectName == "$object" and CounterName == "$metric"
| where TimeGenerated >= $__timeFrom() and TimeGenerated <= $__timeTo()
| where  $__contains(Computer, $computer)
| summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer
| order by TimeGenerated asc
```
