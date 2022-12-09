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

Check out the [Templating]({{< relref "../../variables/" >}}) documentation for an introduction to the templating feature and the different
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

## Limitations

As of Grafana 9.0, a resource URI is constructed to identify resources using the resource picker. On dashboards created prior to Grafana 9.0, Grafana automatically migrates any queries using the prior resource-picking mechanism to use this method.

Some resource types use nested namespaces and resource names, such as `Microsoft.Storage/storageAccounts/tableServices` and `storageAccount/default`, or `Microsoft.Sql/servers/databases` and `serverName/databaseName`. Such template variables cannot be used because the result could be a malformed resource URI.

### Supported cases

#### Standard namespaces and resource names

```kusto
metricDefinition = $ns
$ns = Microsoft.Compute/virtualMachines
resourceName = $rs
$rs = testvirtualmachine
```

#### Namespaces with a non-templated sub-namespace

```kusto
metricDefinition = $ns/tableServices
$ns = Microsoft.Storage/storageAccounts
resourceName = $rs/default
$rs = storageaccount
```

#### Storage namespaces missing the `default` keyword

```kusto
metricDefinition = $ns/tableServices
$ns = Microsoft.Storage/storageAccounts
resourceName = $rs
$rs = storageaccount
```

#### Namespaces with a templated sub-namespace

```kusto
metricDefinition = $ns/$sns
$ns = Microsoft.Storage/storageAccounts
$sns = tableServices
resourceName = $rs
$rs = storageaccount
```

### Unsupported case

If a dashboard uses this unsupported case, migrate it to one of the [supported cases](#supported-cases).

If a namespace or resource name template variable contains multiple segments, Grafana will construct the resource URI incorrectly because the template variable cannot be appropriately split.

For example:

```kusto
metricDefinition = $ns
resourceName = $rs
$ns = 'Microsoft.Storage/storageAccounts/tableServices'
$rs = 'storageaccount/default'
```

This would result in an incorrect resource URI containing `Microsoft.Storage/storageAccounts/tableServices/storageaccount/default`. However, the correct URI would have the format `Microsoft.Storage/storageAccounts/storageaccount/tableServices/default`.

An appropriate fix would be to update the template variable that does not match a supported case. If the namespace variable `$ns` is of the form `Microsoft.Storage/storageAccounts/tableServices` this could be split into two variables: `$ns1 = Microsoft.Storage/storageAccounts` and `$ns2 = tableServices`. The metric definition would then take the form `$ns1/$ns2` which leads to a correctly formatted URI.
