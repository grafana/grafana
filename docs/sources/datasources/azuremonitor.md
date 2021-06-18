+++
title = "Azure Monitor"
description = "Guide for using Azure Monitor in Grafana"
keywords = ["grafana", "microsoft", "azure", "monitor", "application", "insights", "log", "analytics", "guide"]
aliases = ["/docs/grafana/latest/features/datasources/azuremonitor"]
weight = 300
+++

# Azure Monitor data source

Grafana includes built-in support for Azure Monitor, the Azure service to maximise availability and performance of your applications and services in the Azure Cloud. The Azure Monitor data source supports visualising data from three Azure services:

- **Azure Monitor Metrics** to collect numeric data from resources in your Azure account
- **Azure Monitor Logs** to collect log and performance data from your Azure account, and query using the powerful Kusto Language
- **Azure Resource Graph** to quickly query your Azure resources across subscriptions

This topic explains configuring, querying, and other options specific to the Azure Monitor data source. Refer to [Add a data source]({{< relref "add-a-data-source.md" >}}) for instructions on how to add a data source to Grafana.

## Azure Monitor configuration

To access Azure Monitor configuration, hover your mouse over the **Configuration** (gear) icon, click **Data Sources**, and then click the Azure Monitor data source. If you haven't already, you'll need to [add the Azure Monitor data source]({{< relref "add-a-data-source.md" >}}).

You must create an app registration and service principal in Azure AD to authenticate the data source. See the [Azure documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal#get-tenant-and-app-id-values-for-signing-in) for configuration details. Alternatively, if you are hosting Grafana in Azure (e.g. App Service, or Azure Virtual Machines) you can configure the Azure Monitor data source to use Managed Identity to securely authenticate without entering credentials into Grafana. Refer to [Configuring using Managed Identity](#configuring-using-managed-identity) for more details.

| Name                    | Description                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication          | Enables Managed Identity. Selecting Managed Identity will hide many of the fields below. See [Configuring using Managed Identity](#configuring-using-managed-identity) for more details.                                                                                                                                |
| Azure Cloud             | The national cloud for your Azure account. For most users, this is the default "Azure". For more information, see [the Azure documentation.](https://docs.microsoft.com/en-us/azure/active-directory/develop/authentication-national-cloud)                                                                             |
| Directory (tenant) ID   | The directory/tenant ID for the Azure AD app registration to use for authentication. See [Get tenant and app ID values for signing in](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal#get-tenant-and-app-id-values-for-signing-in) from the Azure documentation. |
| Application (client) ID | The application/client ID for the Azure AD app registration to use for authentication.                                                                                                                                                                                                                                  |
| Client secret           | The application client secret for the Azure AD app registration to use for authentication. See [Create a new application secret](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal#option-2-create-a-new-application-secret) from the Azure documentation.          |
| Default subscription    | _(optional)_ Sets a default subscription for template variables to use                                                                                                                                                                                                                                                  |
| Default workspace       | _(optional)_ Sets a default workspace for Log Analytics-based template variable queries to use                                                                                                                                                                                                                          |

## Azure Monitor query editor

The Azure Monitor data source has three different modes depending on which Azure service you wish to query:

- **Metrics** for [Azure Monitor Metrics](https://docs.microsoft.com/en-us/azure/azure-monitor/essentials/data-platform-metrics)
- **Logs** for [Azure Monitor Logs](https://docs.microsoft.com/en-us/azure/azure-monitor/logs/data-platform-logs)
- [**Azure Resource Graph**](https://docs.microsoft.com/en-gb/azure/governance/resource-graph/overview)

### Querying Azure Monitor Metrics

Azure Monitor Metrics collects numeric data from [supported resources](https://docs.microsoft.com/en-us/azure/azure-monitor/monitor-reference) and allows you to query them to investigate the health and utilization of your resources to maximise availability and performance.

Metrics are a lightweight format that only stores simple numeric data in a particular structure. Metrics is capable for supporting near real-time scenarios making it useful for fast detection of issues. Azure Monitor Logs can store a variety of different data types each with their own structure.

> TODO: metrics screenshot

#### Your first Azure Monitor Metrics query

1. Select the Metrics service
1. Select a resource to pull metrics from using the subscription, resource group, resource type, and resource fields.
1. Some resources, such as storage accounts, organise metrics under multiple metric namespaces. Grafana will pick a default namespace, but change this to see which other metrics are available.
1. Select a metric from the Metric field.

Optionally, you can apply further aggregations or filter by dimensions for further analysis.

1. Change the aggregation from the default average to show minimum, maximum or total values.
1. Set a specific custom time grain. By default Grafana will automatically select a time grain interval based on your selected time range.
1. For metrics that have multiple dimensions, you can split and filter further the returned metrics. For example, the Application Insights dependency calls metric supports returning multiple time series for successful vs unsuccessful calls.

The options available will change depending on what is most relevant to the selected metric.

#### Legend alias formatting

The legend label for Metrics can be changed using aliases. In the Legend Format field, you can combine aliases defined below any way you want e.g

- `Blob Type: {{ blobtype }}` becomes `Blob Type: PageBlob`, `Blob Type: BlockBlob`
- `{{ resourcegroup }} - {{ resourcename }}` becomes `production - web_server`

| Alias pattern               | Description                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| {{ resourcegroup }}         | Replaced with the the resource group                                                        |
| {{ namespace  }}            | Replaced with the resource type / namespace (e.g. Microsoft.Compute/virtualMachines)        |
| {{ resourcename  }}         | Replaced with the resource name                                                             |
| {{ metric  }}               | Replaced with the metric name (e.g. Percentage CPU)                                         |
| _{{ arbitaryDimensionID }}_ | Replaced with the value of the specified dimension. (e.g. {{ blobtype }} becomes BlockBlob) |
| {{ dimensionname  }}        | _(Legacy for backwards compatibility)_ Replaced with the name of the first dimension        |
| {{ dimensionvalue  }}       | _(Legacy for backwards compatibility)_ Replaced with the value of the first dimension       |

#### Supported Azure Monitor metrics

Not all metrics returned by the Azure Monitor Metrics API have values. To make it easier for you when building a query, the Grafana data source has a list of supported metrics and ignores metrics which will never have values. This list is updated regularly as new services and metrics are added to the Azure cloud. For more information about the list of metrics, refer to [current supported namespaces](https://github.com/grafana/grafana/blob/main/public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_monitor/supported_namespaces.ts).

### Querying Azure Monitor Logs

Azure Monitor Logs collects and organises log and performance data from [supported resources](https://docs.microsoft.com/en-us/azure/azure-monitor/monitor-reference) and makes many sources of data available to query together with the sophisticated [Kusto Query Language (KQL)](https://docs.microsoft.com/en-us/azure/data-explorer/kusto/query/).

While Azure Monitor Metrics only stores simplified numerical data, Logs can store different data types each with their own structure and can perform complexe analysis of data using KQL.

#### Your first Azure Monitor Logs query

1. Select the Logs service
2. Select a resource to query. Alternatively, you can dynamically query all resources under a single resource group or subscription.
3. Enter in your KQL query. See below for examples.

##### Kusto Query Language

Azure Monitor Logs queries are written using the Kusto Query Language (KQL), a rich language designed to be easy to read and write, which should be familiar to those know who SQL. The Azure documentation has plenty of resource to help with learning KQL:

- [Log queries in Azure Monitor](https://docs.microsoft.com/en-us/azure/azure-monitor/logs/log-query-overview)
- [Getting started with Kusto](https://docs.microsoft.com/en-us/azure/data-explorer/kusto/concepts/)
- [Tutorial: Use Kusto queries in Azure Monitor](https://docs.microsoft.com/en-us/azure/data-explorer/kusto/query/tutorial?pivots=azuremonitor)
- [SQL to Kusto cheat sheet](https://docs.microsoft.com/en-us/azure/data-explorer/kusto/query/sqlcheatsheet)

Here is an example query that returns a virtual machine's CPU performance, averaged over 5m time grains

```kusto
Perf
# $__timeFilter is a special Grafana macro that filters the results to the time span of the dashboard
| where $__timeFilter(TimeGenerated)
| where CounterName == "% Processor Time"
| summarize avg(CounterValue) by bin(TimeGenerated, 5m), Computer
| order by TimeGenerated asc
```

Time series queries are for values that change over time, usually for graph visualisations such as the Time series panel. Each query should return at least a datetime column and a numeric value column. The result must also be sorted in ascending order by the datetime column.

A query can also have one or more non-numeric/non-datetime columns, and those columns are considered dimensions and become labels in the response. For example, a query that returns the aggregated count grouped by hour, Computer, and the CounterName:

```kusto
Perf
| where $__timeFilter(TimeGenerated)
| summarize count() by bin(TimeGenerated, 1h), Computer, CounterName
| order by TimeGenerated asc
```

You can also select additional number value columns (with, or without multiple dimensions). For example, getting a count and average value by hour, Computer, CounterName, and InstanceName:

```kusto
Perf
| where $__timeFilter(TimeGenerated)
| summarize Samples=count(), ["Avg Value"]=avg(CounterValue)
    by bin(TimeGenerated, $__interval), Computer, CounterName, InstanceName
| order by TimeGenerated asc
```

Table queries are mainly used in the Table panel and show a list of columns and rows. This example query returns rows with the six specified columns:

```kusto
AzureActivity
| where $__timeFilter()
| project TimeGenerated, ResourceGroup, Category, OperationName, ActivityStatus, Caller
| order by TimeGenerated desc
```

##### Logs macros

To make writing queries easier there are several Grafana macros that can be used in the where clause of a query:

| Macro                           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$__timeFilter()`               | Used to filter the results to the time range of the dashboard.<br/>Example: `TimeGenerated >= datetime(2018-06-05T18:09:58.907Z) and TimeGenerated <= datetime(2018-06-05T20:09:58.907Z)`.                                                                                                                                                                                                                                                                                                                 |
| `$__timeFilter(datetimeColumn)` | Like `$__timeFilter()`, but specifies a custom field to filter on.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `$__timeFrom()`                 | Expands to the start of the dashboard time range.<br/>Example: `datetime(2018-06-05T18:09:58.907Z)`.                                                                                                                                                                                                                                                                                                                                                                                                       |
| `$__timeTo()`                   | Expands to the end of the dashboard time range.<br/>Example: `datetime(2018-06-05T20:09:58.907Z)`.                                                                                                                                                                                                                                                                                                                                                                                                         |
| `$__escapeMulti($myVar)`        | Used with multi-value template variables that contain illegal characters.<br/>If `$myVar` has the following two values as a string `'\\grafana-vm\Network(eth0)\Total','\\hello!'`, then it expands to `@'\\grafana-vm\Network(eth0)\Total', @'\\hello!'`.<br/><br/>If using single value variables there is no need for this macro, simply escape the variable inline instead - `@'\$myVar'`.                                                                                                             |
| `$__contains(colName, $myVar)`  | Used with multi-value template variables.<br/>If `$myVar` has the value `'value1','value2'`, it expands to: `colName in ('value1','value2')`.<br/><br/>If using the `All` option, then check the `Include All Option` checkbox and in the `Custom all value` field type in the value `all`. If `$myVar` has value `all` then the macro will instead expand to `1 == 1`. For template variables with a lot of options, this will increase the query performance by not building a large "where..in" clause. |

Additionally, Grafana has the built-in `$__interval` macro

### Querying with Azure Resource Graph

Azure Resource Graph (ARG) is a service in Azure that is designed to extend Azure Resource Management by providing efficient and performant resource exploration, with the ability to query at scale across a given set of subscriptions so that you can effectively govern your environment. By querying ARG, you can query resources with complex filtering, iteratively explore resources based on governance requirements, and assess the impact of applying policies in a vast cloud environment.

### Your first Azure Resource Graph query

ARG queries are written in a variant of the [Kusto Query Language](https://docs.microsoft.com/en-us/azure/governance/resource-graph/concepts/query-language), but not all Kusto language features are available in ARG. An Azure Resource Graph query is formatted as table data.

If your credentials give you access to multiple subscriptions, then you can choose multiple subscriptions before entering queries.

#### Sort results by resource properties

Here is an example query that returns all resources in the selected subscriptions, but only the name, type, and location properties:

```kusto
Resources
| project name, type, location
| order by name asc
```

The query uses `order by` to sort the properties by the `name` property in ascending (`asc`) order. You can change what property to sort by and the order (`asc` or `desc`). The query uses `project` to show only the listed properties in the results. You can add or remove properties.

#### Query resources with complex filtering

Filtering for Azure resources with a tag name of `environment` that have a value of `Internal`. You can change these to any desired tag key and value. The `=~` in the `type` match tells Resource Graph to be case insensitive. You can project by other properties or add/remove more.

For example, a query that returns a list of resources with an `environment` tag value of `Internal`:

```kusto
Resources
| where tags.environment=~'internal'
| project name
```

#### Group and aggregate the values by property

You can also use `summarize` and `count` to define how to group and aggregate the values by property. For example, returning count of healthy, unhealthy, and not applicable resources per recommendation:

```kusto
securityresources
| where type == 'microsoft.security/assessments'
| extend resourceId=id,
    recommendationId=name,
    resourceType=type,
    recommendationName=properties.displayName,
    source=properties.resourceDetails.Source,
    recommendationState=properties.status.code,
    description=properties.metadata.description,
    assessmentType=properties.metadata.assessmentType,
    remediationDescription=properties.metadata.remediationDescription,
    policyDefinitionId=properties.metadata.policyDefinitionId,
    implementationEffort=properties.metadata.implementationEffort,
    recommendationSeverity=properties.metadata.severity,
    category=properties.metadata.categories,
    userImpact=properties.metadata.userImpact,
    threats=properties.metadata.threats,
    portalLink=properties.links.azurePortal
| summarize numberOfResources=count(resourceId) by tostring(recommendationName), tostring(recommendationState)
```

In Azure Resource Graph many nested properties (`properties.displayName`) are of a `dynamic` type, and should be cast to a string with `tostring()` to operate on them.

The Azure documentation also hosts [many sample queries](https://docs.microsoft.com/en-gb/azure/governance/resource-graph/samples/starter) to help you get started

## Going further with Azure Monitor

### Template variables

Instead of hard-coding values for fields like resource group or resource name in your queries, you can use variables in their place to create more interactive, dynamic, and reusable dashboards.

Check out the [Templating]({{< relref "../variables/_index.md" >}}) documentation for an introduction to the templating feature and the different
types of template variables.

> **Note:** Azure Monitor Metrics does not support multiple values. To visualize multiple time series (for example, metrics for two servers), add multiple queries to view them in the same panel

The Azure Monitor data source provides the following queries you can specify in the Query field in the Variable edit view

| Name                                                                         | Description                                                                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `Subscriptions()`                                                            | Returns subscriptions.                                                                                 |
| `ResourceGroups()`                                                           | Returns resource groups.                                                                               |
| `ResourceGroups(subscriptionID)`                                             | Returns resource groups for a specified subscription.                                                  |
| `Namespaces(aResourceGroup)`                                                 | Returns namespaces for the default subscription and specified resource group.                          |
| `Namespaces(subscriptionID, aResourceGroup)`                                 | Returns namespaces for the specified subscription and resource group.                                  |
| `ResourceNames(aResourceGroup, aNamespace)`                                  | Returns a list of resource names.                                                                      |
| `ResourceNames(subscriptionID, aResourceGroup, aNamespace)`                  | Returns a list of resource names for a specified subscription.                                         |
| `MetricNamespace(aResourceGroup, aNamespace, aResourceName)`                 | Returns a list of metric namespaces.                                                                   |
| `MetricNamespace(subscriptionID, aResourceGroup, aNamespace, aResourceName)` | Returns a list of metric namespaces for a specified subscription.                                      |
| `MetricNames(aResourceGroup, aNamespace, aResourceName)`                     | Returns a list of metric names.                                                                        |
| `MetricNames(subscriptionID, aResourceGroup, aNamespace, aResourceName)`     | Returns a list of metric names for a specified subscription.                                           |
| `workspaces()`                                                               | Returns a list of workspaces for the default subscription.                                             |
| `workspaces(subscriptionID)`                                                 | Returns a list of workspaces for the specified subscription (the parameter can be quoted or unquoted). |

Where a subscription ID is not specified, a default subscription must be specified in the data source configuration, which will be used.

Any Log Analytics KQL query that returns a single list of values can also be used in the Query field. For example:

| Query                                                                                   | Description                                               |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `workspace("myWorkspace").Heartbeat \| distinct Computer`                               | Returns a list of Virtual Machines                        |
| `workspace("$workspace").Heartbeat \| distinct Computer`                                | Returns a list of Virtual Machines with template variable |
| `workspace("$workspace").Perf \| distinct ObjectName`                                   | Returns a list of objects from the Perf table             |
| `workspace("$workspace").Perf \| where ObjectName == "$object" \| distinct CounterName` | Returns a list of metric names from the Perf table        |

Example of a time series query using variables:

```kusto
Perf
| where ObjectName == "$object" and CounterName == "$metric"
| where TimeGenerated >= $__timeFrom() and TimeGenerated <= $__timeTo()
| where  $__contains(Computer, $computer)
| summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer
| order by TimeGenerated asc
```

### Configuring using Managed Identity

Customers who host Grafana in Azure (e.g. App Service, Azure Virtual Machines) and have managed identity enabled on their VM, will now be able to use the managed identity to configure Azure Monitor in Grafana. This will simplify the data source configuration, requiring the data source to be securely authenticated without having to manually configure credentials via Azure AD App Registrations for each data source. For more details on Azure managed identities, refer to the [Azure documentation](https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview).

To enable managed identity for Grafana, set the `managed_identity_enabled` flag in the `[azure]` section of the [Grafana server config](https://grafana.com/docs/grafana/latest/administration/configuration/#azure).

```ini
[azure]
managed_identity_enabled = true
```

Then, in the Azure Monitor data source configuration and set Authentication to Managed Identity. The directory ID, application ID and client secret fields will be hidden and the data source will use managed identity for authenticating to Azure Monitor Metrics, Logs, and Azure Resource Graph.

### Configure the data source with provisioning

You can configure data sources using config files with Grafana’s provisioning system. For more information on how it works and all the settings you can set for data sources on the [provisioning docs page]({{< relref "../administration/provisioning/#datasources" >}})

Here are some provisioning examples for this data source.

#### Azure AD App Registration (client secret)

```yaml
# config file version
apiVersion: 1

datasources:
  - name: Azure Monitor
    type: grafana-azure-monitor-datasource
    access: proxy
    jsonData:
      azureAuthType: clientsecret
      cloudName: azuremonitor # See table below
      tenantId: <tenant-id>
      clientId: <client-id>
      subscriptionId: <subscription-id> # Optional, default subscription
    secureJsonData:
      clientSecret: <client-secret>
    version: 1
```

#### Managed Identity

```yaml
# config file version
apiVersion: 1

datasources:
  - name: Azure Monitor
    type: grafana-azure-monitor-datasource
    access: proxy
    jsonData:
      azureAuthType: msi
      subscriptionId: <subscription-id> # Optional, default subscription
    version: 1
```

### Supported cloud names

| Azure Cloud                                      | Value                      |
| ------------------------------------------------ | -------------------------- |
| Microsoft Azure public cloud                     | `azuremonitor` (_default_) |
| Microsoft Chinese national cloud                 | `chinaazuremonitor`        |
| US Government cloud                              | `govazuremonitor`          |
| Microsoft German national cloud ("Black Forest") | `germanyazuremonitor`      |

## Deprecated Application Insights and Insights Analytics

Application Insights and Insights Analytics are two ways to query the same Azure Application Insights data, which can also be queried from Metrics and Logs. In Grafana 8.0, Application Insights and Insights Analytics are deprecated and made read-only in favor of querying this data through Metrics and Logs. Existing queries will continue to work, but you cannot edit them. New panels are not able to use Application Insights or Insights Analytics.

For Application Insights, new queries can be made with the Metrics query type by selecting the "Application Insights" resource type.

{{< figure src="/static/img/docs/azure-monitor/app-insights-metrics.png" max-width="650px" class="docs-image--no-shadow" caption="Azure Monitor Application Insights example" >}}

For Insights Analaytics, new queries can be written with Kusto in the Logs query type by selecting your Application Insights resource.

{{< figure src="/static/img/docs/azure-monitor/app-insights-logs.png" max-width="650px" class="docs-image--no-shadow" caption="Azure Logs Application Insights example" >}}

The new resource picker for Logs shows all resources on your Azure subscription compatible with Logs.

{{< figure src="/static/img/docs/azure-monitor/app-insights-resource-picker.png" max-width="650px" class="docs-image--no-shadow" caption="Azure Logs Application Insights resource picker" >}}

Azure Monitor Metrics and Azure Monitor Logs do not use Application Insights API keys, so make sure the data source is configured with an Azure AD app registration that has access to Application Insights
