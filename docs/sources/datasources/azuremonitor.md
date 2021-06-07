+++
title = "Azure Monitor"
description = "Guide for using Azure Monitor in Grafana"
keywords = ["grafana", "microsoft", "azure", "monitor", "application", "insights", "log", "analytics", "guide"]
aliases = ["/docs/grafana/latest/features/datasources/azuremonitor"]
weight = 300
+++

# Azure Monitor data source

The Azure Monitor data source supports multiple services in the Azure cloud:

- **[Azure Monitor Metrics]({{< relref "#query-the-metrics-service" >}})** (or Metrics) is the platform service that provides a single source for monitoring Azure resources.
- **[Azure Monitor Logs]({{< relref "#query-the-logs-service" >}})** (or Logs) gives you access to log data collected by Azure Monitor.
- **[Azure Resource Graph]({{< relref "#query-the-azure-resource-graph-service" >}})** allows you to query the resources on your Azure subscription.

## Add the data source

The Azure Monitor data source can access metrics from three different services. Configure access to the services that you plan to use. To use different credentials for different Azure services, configure multiple Azure Monitor data sources.

- [Guide to setting up an Azure Active Directory Application for Azure Monitor.](https://docs.microsoft.com/en-us/azure/azure-resource-manager/resource-group-create-service-principal-portal)
- [Guide to setting up an Azure Active Directory Application for Azure Monitor Logs.](https://dev.loganalytics.io/documentation/Authorization/AAD-Setup)

1. Accessed from the Grafana main menu, newly installed data sources can be added immediately within the Data Sources section. Next, click the "Add data source" button in the upper right. The Azure Monitor data source will be available for selection in the Cloud section in the list of data sources.

1. In the name field, Grafana will automatically fill in a name for the data source - `Azure Monitor` or something like `Azure Monitor - 3`. If you are going to configure multiple data sources, then change the name to something more informative.

1. Fill in the Azure AD App Registration details:

   - **Tenant Id** (Azure Active Directory -> Properties -> Directory ID)
   - **Client Id** (Azure Active Directory -> App Registrations -> Choose your app -> Application ID)
   - **Client Secret** (Azure Active Directory -> App Registrations -> Choose your app -> Keys)
   - **Default Subscription Id** (Subscriptions -> Choose subscription -> Overview -> Subscription ID)

1. Paste these four items into the fields in the Azure Monitor API Details section:
   {{< figure src="/static/img/docs/v62/config_1_azure_monitor_details.png" class="docs-image--no-shadow" caption="Azure Monitor Configuration Details" >}}

   - The Subscription Id can be changed per query. Save the data source and refresh the page to see the list of subscriptions available for the specified Client Id.

1. Test that the configuration details are correct by clicking on the "Save & Test" button:
   {{< figure src="/static/img/docs/v62/config_3_save_and_test.png" class="docs-image--no-shadow" caption="Save and Test" >}}

Alternatively on step 4 if creating a new Azure Active Directory App, use the [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/?view=azure-cli-latest):

```bash
az ad sp create-for-rbac -n "http://localhost:3000"
```

## Choose a Service

In the query editor for a panel, after choosing your Azure Monitor data source, the first option is to choose a service. There are three options here:

- Metrics
- Logs
- Azure Resource Graph

The query editor changes depending on which one you pick. Metrics is the default.

In Grafana 7.4, the Azure Monitor query type was renamed to Metrics, and Azure Logs Analytics was renamed to Logs. In Grafana 8.0 Application Insights and Insights Analytics is unavailable for new panels, in favor of querying through Metrics and Logs.

## Query the Metrics service

The Metrics service provides metrics for all the Azure services that you have running. It helps you understand how your applications on Azure are performing and to proactively find issues affecting your applications.

If your Azure Monitor credentials give you access to multiple subscriptions, then choose the appropriate subscription first.

Examples of metrics that you can get from the service are:

- `Microsoft.Compute/virtualMachines - Percentage CPU`
- `Microsoft.Network/networkInterfaces - Bytes sent`
- `Microsoft.Storage/storageAccounts - Used Capacity`

{{< figure src="/static/img/docs/v60/azuremonitor-service-query-editor.png" class="docs-image--no-shadow" caption="Metrics Query Editor" >}}

As of Grafana 7.1, the query editor allows you to query multiple dimensions for metrics that support them. Metrics that support multiple dimensions are those listed in the [Azure Monitor supported Metrics List](https://docs.microsoft.com/en-us/azure/azure-monitor/platform/metrics-supported) that have one or more values listed in the "Dimension" column for the metric.

### Format legend keys with aliases for Metrics

The default legend formatting for the Metrics API is:

`metricName{dimensionName=dimensionValue,dimensionTwoName=DimensionTwoValue}`

> **Note:** Before Grafana 7.1, the formatting included the resource name in the default: `resourceName{dimensionName=dimensionValue}.metricName`. As of Grafana 7.1, the resource name has been removed from the default legend.

These can be quite long, but this formatting can be changed by using aliases. In the **Legend Format** field, you can combine the aliases defined below any way you want.

Metrics examples:

- `Blob Type: {{ blobtype }}`
- `{{ resourcegroup }} - {{ resourcename }}`

### Alias patterns for Metrics

- `{{ resourcegroup }}` = replaced with the value of the Resource Group
- `{{ namespace }}` = replaced with the value of the Namespace (e.g. Microsoft.Compute/virtualMachines)
- `{{ resourcename }}` = replaced with the value of the Resource Name
- `{{ metric }}` = replaced with metric name (e.g. Percentage CPU)
- `{{ dimensionname }}` = _Legacy as of 7.1+ (for backwards compatibility)_ replaced with the first dimension's key/label (as sorted by the key/label) (e.g. blobtype)
- `{{ dimensionvalue }}` = _Legacy as of 7.1+ (for backwards compatibility)_ replaced with first dimension's value (as sorted by the key/label) (e.g. BlockBlob)
- `{{ arbitraryDim }}` = _Available in 7.1+_ replaced with the value of the corresponding dimension. (e.g. `{{ blobtype }}` becomes BlockBlob)

### Create template variables for Metrics

Instead of hard-coding things like server, application and sensor name in your metric queries you can use variables in their place. Variables are shown as dropdown select boxes at the top of the dashboard. These dropdowns make it easy to change the data being displayed in your dashboard.

Note that the Metrics service does not support multiple values yet. If you want to visualize multiple time series (for example, metrics for server1 and server2) then you have to add multiple queries to able to view them on the same graph or in the same table.

The Metrics data source Plugin provides the following queries you can specify in the `Query` field in the Variable edit view. They allow you to fill a variable's options list.

| Name                                                                                               | Description                                                                     |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `Subscriptions()`                                                                                  | Returns a list of subscriptions.                                                |
| `ResourceGroups()`                                                                                 | Returns a list of resource groups.                                              |
| `ResourceGroups(12345678-aaaa-bbbb-cccc-123456789aaa)`                                             | Returns a list of resource groups for a specified subscription.                 |
| `Namespaces(aResourceGroup)`                                                                       | Returns a list of namespaces for the specified resource group.                  |
| `Namespaces(12345678-aaaa-bbbb-cccc-123456789aaa, aResourceGroup)`                                 | Returns a list of namespaces for the specified resource group and subscription. |
| `ResourceNames(aResourceGroup, aNamespace)`                                                        | Returns a list of resource names.                                               |
| `ResourceNames(12345678-aaaa-bbbb-cccc-123456789aaa, aResourceGroup, aNamespace)`                  | Returns a list of resource names for a specified subscription.                  |
| `MetricNamespace(aResourceGroup, aNamespace, aResourceName)`                                       | Returns a list of metric namespaces.                                            |
| `MetricNamespace(12345678-aaaa-bbbb-cccc-123456789aaa, aResourceGroup, aNamespace, aResourceName)` | Returns a list of metric namespaces for a specified subscription.               |
| `MetricNames(aResourceGroup, aNamespace, aResourceName)`                                           | Returns a list of metric names.                                                 |
| `MetricNames(12345678-aaaa-bbbb-cccc-123456789aaa, aResourceGroup, aNamespace, aResourceName)`     | Returns a list of metric names for a specified subscription.                    |

Examples:

- Resource Groups query: `ResourceGroups()`
- Passing in metric name variable: `Namespaces(cosmo)`
- Chaining template variables: `ResourceNames($rg, $ns)`
- Do not quote parameters: `MetricNames(hg, Microsoft.Network/publicIPAddresses, grafanaIP)`

{{< figure src="/static/img/docs/v60/azuremonitor-service-variables.png" class="docs-image--no-shadow" caption="Nested Azure Monitor Template Variables" >}}

Check out the [Templating]({{< relref "../variables/_index.md" >}}) documentation for an introduction to the templating feature and the different
types of template variables.

### List of supported Azure Monitor metrics

Not all metrics returned by the Azure Monitor Metrics API have values. To make it easier for you when building a query, the Grafana data source has a list of supported metrics and ignores metrics which will never have values. This list is updated regularly as new services and metrics are added to the Azure cloud. For more information about the list of metrics, refer to [current supported namespaces](https://github.com/grafana/grafana/blob/main/public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_monitor/supported_namespaces.ts).

### Alerting

Grafana alerting is supported for the Azure Monitor service. This is not Azure Alerts support. For more information about Grafana alerting, refer to [how alerting in Grafana works]({{< relref "../alerting/_index.md" >}}).

{{< figure src="/static/img/docs/v60/azuremonitor-alerting.png" class="docs-image--no-shadow" caption="Azure Monitor Alerting" >}}

## Query the Logs service

Queries are written in the [Kusto Query Language](https://docs.microsoft.com/en-us/azure/data-explorer/kusto/query/). A Logs query can be formatted as time series data or as table data.

If your credentials give you access to multiple subscriptions, then choose the appropriate subscription before entering queries.

### Time series queries

Time series queries are for the Graph panel and other panels like the SingleStat panel. Each query must contain at least a datetime column and a numeric value column. The result must also be sorted in ascending order by the datetime column.

Here is an example query that returns the aggregated count grouped by hour:

```kusto
Perf
| where $__timeFilter(TimeGenerated)
| summarize count() by bin(TimeGenerated, 1h)
| order by TimeGenerated asc
```

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

> **Tip**: In the above query, the Kusto syntax `Samples=count()` and `["Avg Value"]=...` is used to rename those columns — the second syntax allowing for the space. This changes the name of the metric that Grafana uses, and as a result, things like series legends and table columns will match what you specify. Here `Samples` is displayed instead of `_count`.

{{< figure src="/static/img/docs/azure-monitor/logs_multi-value_multi-dim.png" class="docs-image--no-shadow" caption="Azure Logs query with multiple values and multiple dimensions" >}}

### Table queries

Table queries are mainly used in the Table panel and show a list of columns and rows. This example query returns rows with the six specified columns:

```kusto
AzureActivity
| where $__timeFilter()
| project TimeGenerated, ResourceGroup, Category, OperationName, ActivityStatus, Caller
| order by TimeGenerated desc
```

### Format the display name for Log Analytics

The default display name format is:

`metricName{dimensionName=dimensionValue,dimensionTwoName=DimensionTwoValue}`

This can be customized by using the [display name field option]({{< relref "../panels/standard-options.md#display-name" >}}).

### Logs macros

To make writing queries easier there are several Grafana macros that can be used in the where clause of a query:

- `$__timeFilter()` - Expands to
  `TimeGenerated ≥ datetime(2018-06-05T18:09:58.907Z) and`
  `TimeGenerated ≤ datetime(2018-06-05T20:09:58.907Z)` where the from and to datetimes are from the Grafana time picker.

- `$__timeFilter(datetimeColumn)` - Expands to
  `datetimeColumn ≥ datetime(2018-06-05T18:09:58.907Z) and`
  `datetimeColumn ≤ datetime(2018-06-05T20:09:58.907Z)` where the from and to datetimes are from the Grafana time picker.

- `$__timeFrom()` - Returns the From datetime from the Grafana picker. Example: `datetime(2018-06-05T18:09:58.907Z)`.

- `$__timeTo()` - Returns the From datetime from the Grafana picker. Example: `datetime(2018-06-05T20:09:58.907Z)`.

- `$__escapeMulti($myVar)` - is to be used with multi-value template variables that contain illegal characters. If `$myVar` has the following two values as a string `'\\grafana-vm\Network(eth0)\Total','\\hello!'`, then it expands to: `@'\\grafana-vm\Network(eth0)\Total', @'\\hello!'`. If using single value variables there is no need for this macro, simply escape the variable inline instead - `@'\$myVar'`.

- `$__contains(colName, $myVar)` - is to be used with multi-value template variables. If `$myVar` has the value `'value1','value2'`, it expands to: `colName in ('value1','value2')`.

  If using the `All` option, then check the `Include All Option` checkbox and in the `Custom all value` field type in the following value: `all`. If `$myVar` has value `all` then the macro will instead expand to `1 == 1`. For template variables with a lot of options, this will increase the query performance by not building a large "where..in" clause.

### Logs builtin variables

There are also some Grafana variables that can be used in Logs queries:

- `$__interval` - Grafana calculates the minimum time grain that can be used to group by time in queries. For more information about `$__interval`, refer to [interval variables]({{< relref "../variables/variable-types/_index.md#interval-variables" >}}). It returns a time grain like `5m` or `1h` that can be used in the bin function. E.g. `summarize count() by bin(TimeGenerated, $__interval)`

### Templating with variables for Logs

Any Log Analytics query that returns a list of values can be used in the `Query` field in the Variable edit view. There is also one Grafana function for Log Analytics that returns a list of workspaces.

Refer to the [Variables]({{< relref "../variables/_index.md" >}}) documentation for an introduction to the templating feature and the different
types of template variables.

| Name                                               | Description                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `workspaces()`                                     | Returns a list of workspaces for the default subscription.                                             |
| `workspaces(12345678-aaaa-bbbb-cccc-123456789aaa)` | Returns a list of workspaces for the specified subscription (the parameter can be quoted or unquoted). |

Example variable queries:

<!-- prettier-ignore-start -->
| Query                                                                                   | Description                                               |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `subscriptions()`                                                                       | Returns a list of Azure subscriptions                     |
| `workspaces()`                                                                          | Returns a list of workspaces for default subscription     |
| `workspaces("12345678-aaaa-bbbb-cccc-123456789aaa")`                                    | Returns a list of workspaces for a specified subscription |
| `workspaces("$subscription")`                                                           | With template variable for the subscription parameter     |
| `workspace("myWorkspace").Heartbeat \| distinct Computer`                               | Returns a list of Virtual Machines                        |
| `workspace("$workspace").Heartbeat \| distinct Computer`                                | Returns a list of Virtual Machines with template variable |
| `workspace("$workspace").Perf \| distinct ObjectName`                                   | Returns a list of objects from the Perf table             |
| `workspace("$workspace").Perf \| where ObjectName == "$object" \| distinct CounterName` | Returns a list of metric names from the Perf table        |

<!-- prettier-ignore-end -->

Example of a time series query using variables:

```kusto
Perf
| where ObjectName == "$object" and CounterName == "$metric"
| where TimeGenerated >= $__timeFrom() and TimeGenerated <= $__timeTo()
| where  $__contains(Computer, $computer)
| summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer
| order by TimeGenerated asc
```

### Deep linking from Grafana panels to the Azure Metric Logs query editor in Azure Portal

> Only available in Grafana v7.0+.

{{< figure src="/static/img/docs/v70/azure-log-analytics-deep-linking.png" max-width="500px" class="docs-image--right" caption="Logs deep linking" >}}

Click on a time series in the panel to see a context menu with a link to `View in Azure Portal`. Clicking that link opens the Azure Metric Logs query editor in the Azure Portal and runs the query from the Grafana panel there.

If you're not currently logged in to the Azure Portal, then the link opens the login page. The provided link is valid for any account, but it only displays the query if your account has access to the Azure Metric Logs workspace specified in the query.

<div class="clearfix"></div>

## Query the Azure Resource Graph service

Azure Resource Graph (ARG) is a service in Azure that is designed to extend Azure Resource Management by providing efficient and performant resource exploration with the ability to query at scale across a given set of subscriptions so that you can effectively govern your environment. By querying ARG, you can query resources with complex filtering, iteratively explore resources based on governance requirements, and assess the impact of applying policies in a vast cloud environment.

{{< figure src="/static/img/docs/azure-monitor/azure-resource-graph.png" class="docs-image--no-shadow" caption="Azure Resource Graph editor" max-width="650px" >}}

### Table queries

Queries are written in the [Kusto Query Language](https://docs.microsoft.com/en-us/azure/governance/resource-graph/concepts/query-language). Not all Kusto language features are available in ARG. An Azure Resource Graph query is formatted as table data.

If your credentials give you access to multiple subscriptions, then you can choose multiple subscriptions before entering queries.

### Sort results by resource properties

Here is an example query that returns any type of resource, but only the name, type, and location properties:

```kusto
Resources
| project name, type, location
| order by name asc
```

The query uses `order by` to sort the properties by the `name` property in ascending (asc) order. You can change what property to sort by and the order (`asc` or `desc`). The query uses `project` to show the listed properties in the results. You can add or remove properties.

### Query resources with complex filtering

Filtering for Azure resources with a tag name of `Environment` that have a value of `Internal`. You can change these to any desired tag key and value. The `=~` in the `type` match tells Resource Graph to be case insensitive. You can project by other properties or add/ remove more.

The tag key is case sensitive. `Environment` and `environment` will give different results. For example, a query that returns a list of resources with a specified tag value:

```kusto
Resources
| where tags.environment=~'internal'
| project name
```

### Group and aggregate the values by property

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

## Configure the data source with provisioning

You can configure data sources using config files with Grafana’s provisioning system. For more information on how it works and all the settings you can set for data sources on the [provisioning docs page]({{< relref "../administration/provisioning/#datasources" >}})

Here are some provisioning examples for this data source.

### Azure AD App Registration (client secret)

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

### Managed Identity

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

### App Registration (client secret)

```yaml
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
