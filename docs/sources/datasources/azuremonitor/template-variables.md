---
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

Check out the [Templating]({{< relref "../../variables/_index.md" >}}) documentation for an introduction to the templating feature and the different
types of template variables.

The Azure Monitor data source provides the following queries you can specify in the Query field in the Variable edit view

| Name                                                                               | Description                                                                                            |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `Subscriptions()`                                                                  | Returns subscriptions.                                                                                 |
| `ResourceGroups()`                                                                 | Returns resource groups.                                                                               |
| `ResourceGroups(subscriptionID)`                                                   | Returns resource groups for a specified subscription.                                                  |
| `Namespaces(aResourceGroup)`                                                       | Returns namespaces for the default subscription and specified resource group.                          |
| `Namespaces(subscriptionID, aResourceGroup)`                                       | Returns namespaces for the specified subscription and resource group.                                  |
| `ResourceNames(aResourceGroup, aNamespace)`                                        | Returns a list of resource names.                                                                      |
| `ResourceNames(subscriptionID, aResourceGroup, aNamespace)`                        | Returns a list of resource names for a specified subscription.                                         |
| `MetricNamespace(aResourceGroup, aNamespace, aResourceName)`                       | Returns a list of metric namespaces.                                                                   |
| `MetricNamespace(subscriptionID, aResourceGroup, aNamespace, aResourceName)`       | Returns a list of metric namespaces for a specified subscription.                                      |
| `MetricNames(aResourceGroup, aMetricDefinition, aResourceName, aMetricNamespace)`  | Returns a list of metric names.                                                                        |
| `MetricNames(aSubscriptionID, aMetricDefinition, aResourceName, aMetricNamespace)` | Returns a list of metric names for a specified subscription.                                           |
| `workspaces()`                                                                     | Returns a list of workspaces for the default subscription.                                             |
| `workspaces(subscriptionID)`                                                       | Returns a list of workspaces for the specified subscription (the parameter can be quoted or unquoted). |

Where a subscription ID is not specified, a default subscription must be specified in the data source configuration, which will be used.

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
