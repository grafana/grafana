+++
title = "Using Azure Monitor in Grafana"
description = "Guide for using Azure Monitor in Grafana"
keywords = ["grafana", "microsoft", "azure", "monitor", "application", "insights", "log", "analytics", "guide"]
type = "docs"
aliases = ["/docs/grafana/latest/datasources/azuremonitor"]
[menu.docs]
name = "Azure Monitor"
parent = "datasources"
weight = 5
+++

# Using Azure Monitor in Grafana

> Officially released in Grafana v6.0.0

As of Grafana 6.0, the Azure Monitor plugin has been moved into Grafana so it now ships with built-in support for Azure Monitor.

The Azure Monitor data source supports multiple services in the Azure cloud:

- **[Azure Monitor]({{< relref "#querying-the-azure-monitor-service" >}})** is the platform service that provides a single source for monitoring Azure resources.
- **[Application Insights]({{< relref "#querying-the-application-insights-service" >}})** is an extensible Application Performance Management (APM) service for web developers on multiple platforms and can be used to monitor your live web application - it will automatically detect performance anomalies.
- **[Azure Log Analytics]({{< relref "#querying-the-azure-log-analytics-service" >}})** (or Azure Logs) gives you access to log data collected by Azure Monitor.
- **[Application Insights Analytics]({{< relref "#writing-analytics-queries-for-the-application-insights-service" >}})** allows you to query [Application Insights data](https://docs.microsoft.com/en-us/azure/azure-monitor/app/analytics) using the same query language used for Azure Log Analytics.

## Adding the data source

The data source can access metrics from four different services. You can configure access to the services that you use. It is also possible to use the same credentials for multiple services if that is how you have set it up in Azure AD.

- [Guide to setting up an Azure Active Directory Application for Azure Monitor.](https://docs.microsoft.com/en-us/azure/azure-resource-manager/resource-group-create-service-principal-portal)
- [Guide to setting up an Azure Active Directory Application for Azure Log Analytics.](https://dev.loganalytics.io/documentation/Authorization/AAD-Setup)
- [Quickstart Guide for Application Insights.](https://dev.applicationinsights.io/quickstart/)

1. Accessed from the Grafana main menu, newly installed data sources can be added immediately within the Data Sources section. Next, click the "Add data source" button in the upper right. The Azure Monitor data source will be available for selection in the Cloud section in the list of data sources.

2. In the name field, Grafana will automatically fill in a name for the data source - `Azure Monitor` or something like `Azure Monitor - 3`. If you are going to configure multiple data sources then change the name to something more informative.

3. If you are using Azure Monitor, you need 4 pieces of information from the Azure portal (see link above for detailed instructions):

   - **Tenant Id** (Azure Active Directory -> Properties -> Directory ID)
   - **Client Id** (Azure Active Directory -> App Registrations -> Choose your app -> Application ID)
   - **Client Secret** ( Azure Active Directory -> App Registrations -> Choose your app -> Keys)
   - **Default Subscription Id** (Subscriptions -> Choose subscription -> Overview -> Subscription ID)

4. Paste these four items into the fields in the Azure Monitor API Details section:
   {{< docs-imagebox img="/img/docs/v62/config_1_azure_monitor_details.png" class="docs-image--no-shadow" caption="Azure Monitor Configuration Details" >}}

   - The Subscription Id can be changed per query. Save the data source and refresh the page to see the list of subscriptions available for the specified Client Id.

5. If you are also using the Azure Log Analytics service, then you need to specify these two config values (or you can reuse the Client Id and Secret from the previous step).

   - Client Id (Azure Active Directory -> App Registrations -> Choose your app -> Application ID)
   - Client Secret (Azure Active Directory -> App Registrations -> Choose your app -> Keys -> Create a key -> Use client secret)

6. If you are using Application Insights, then you need two pieces of information from the Azure Portal (see link above for detailed instructions):

   - Application ID
   - API Key

7. Paste these two items into the appropriate fields in the Application Insights API Details section:
   {{< docs-imagebox img="/img/docs/v62/config_2_app_insights_api_details.png" class="docs-image--no-shadow" caption="Application Insights Configuration Details" >}}

8. Test that the configuration details are correct by clicking on the "Save & Test" button:
   {{< docs-imagebox img="/img/docs/v62/config_3_save_and_test.png" class="docs-image--no-shadow" caption="Save and Test" >}}

Alternatively on step 4 if creating a new Azure Active Directory App, use the [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/?view=azure-cli-latest):

```bash
az ad sp create-for-rbac -n "http://localhost:3000"
```

## Choose a Service

In the query editor for a panel, after choosing your Azure Monitor data source, the first option is to choose a service. There are three options here:

- `Azure Monitor`
- `Application Insights`
- `Azure Log Analytics`

The query editor will change depending on which one you pick. Azure Monitor is the default.

## Querying the Azure Monitor Service

The Azure Monitor service provides metrics for all the Azure services that you have running. It helps you understand how your applications on Azure are performing and to proactively find issues affecting your applications.

If your Azure Monitor credentials give you access to multiple subscriptions then choose the appropriate subscription first.

Examples of metrics that you can get from the service are:

- `Microsoft.Compute/virtualMachines - Percentage CPU`
- `Microsoft.Network/networkInterfaces - Bytes sent`
- `Microsoft.Storage/storageAccounts - Used Capacity`

{{< docs-imagebox img="/img/docs/v60/azuremonitor-service-query-editor.png" class="docs-image--no-shadow" caption="Azure Monitor Query Editor" >}}

### Formatting Legend Keys with Aliases for the Azure Monitor Service

The default legend formatting for the Azure Monitor API is:

`resourceName{dimensionValue=dimensionName}.metricName`

These can be quite long but this formatting can be changed using aliases. In the Legend Format field, the aliases which are defined below can be combined any way you want.

Azure Monitor Examples:

- `dimension: {{dimensionvalue}}`
- `{{resourcegroup}} - {{resourcename}}`

### Alias Patterns for Azure Monitor

- `{{resourcegroup}}` = replaced with the value of the Resource Group
- `{{namespace}}` = replaced with the value of the Namespace (e.g. Microsoft.Compute/virtualMachines)
- `{{resourcename}}` = replaced with the value of the Resource Name
- `{{metric}}` = replaced with metric name (e.g. Percentage CPU)
- `{{dimensionname}}` = replaced with dimension key/label (e.g. blobtype)
- `{{dimensionvalue}}` = replaced with dimension value (e.g. BlockBlob)

### Templating with Variables for the Azure Monitor Service

Instead of hard-coding things like server, application and sensor name in you metric queries you can use variables in their place. Variables are shown as dropdown select boxes at the top of the dashboard. These dropdowns makes it easy to change the data being displayed in your dashboard.

Note that the Azure Monitor service does not support multiple values yet. If you want to visualize multiple time series (for example, metrics for server1 and server2) then you have to add multiple queries to able to view them on the same graph or in the same table.

The Azure Monitor data source Plugin provides the following queries you can specify in the `Query` field in the Variable edit view. They allow you to fill a variable's options list.

| Name                                                                                               | Description                                                                     |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| _Subscriptions()_                                                                                  | Returns a list of subscriptions.                                                |
| _ResourceGroups()_                                                                                 | Returns a list of resource groups.                                              |
| _ResourceGroups(12345678-aaaa-bbbb-cccc-123456789aaa)_                                             | Returns a list of resource groups for a specified subscription.                 |
| _Namespaces(aResourceGroup)_                                                                       | Returns a list of namespaces for the specified resource group.                  |
| _Namespaces(12345678-aaaa-bbbb-cccc-123456789aaa, aResourceGroup)_                                 | Returns a list of namespaces for the specified resource group and subscription. |
| _ResourceNames(aResourceGroup, aNamespace)_                                                        | Returns a list of resource names.                                               |
| _ResourceNames(12345678-aaaa-bbbb-cccc-123456789aaa, aResourceGroup, aNamespace)_                  | Returns a list of resource names for a specified subscription.                  |
| _MetricNamespace(aResourceGroup, aNamespace, aResourceName)_                                       | Returns a list of metric namespaces.                                            |
| _MetricNamespace(12345678-aaaa-bbbb-cccc-123456789aaa, aResourceGroup, aNamespace, aResourceName)_ | Returns a list of metric namespaces for a specified subscription.               |
| _MetricNames(aResourceGroup, aNamespace, aResourceName)_                                           | Returns a list of metric names.                                                 |
| _MetricNames(12345678-aaaa-bbbb-cccc-123456789aaa, aResourceGroup, aNamespace, aResourceName)_     | Returns a list of metric names for a specified subscription.                    |

Examples:

- Resource Groups query: `ResourceGroups()`
- Passing in metric name variable: `Namespaces(cosmo)`
- Chaining template variables: `ResourceNames($rg, $ns)`
- Do not quote parameters: `MetricNames(hg, Microsoft.Network/publicIPAddresses, grafanaIP)`

{{< docs-imagebox img="/img/docs/v60/azuremonitor-service-variables.png" class="docs-image--no-shadow" caption="Nested Azure Monitor Template Variables" >}}

Check out the [Templating]({{< relref "../../reference/templating.md" >}}) documentation for an introduction to the templating feature and the different
types of template variables.

### Azure Monitor Metrics Whitelist

Not all metrics returned by the Azure Monitor API have values. The Grafana data source has a whitelist to only return metric names if it is possible they might have values. This whitelist is updated regularly as new services and metrics are added to the Azure cloud. You can find the current whitelist [here](https://github.com/grafana/grafana/blob/master/public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_monitor/supported_namespaces.ts).

### Azure Monitor Alerting

Grafana alerting is supported for the Azure Monitor service. This is not Azure Alerts support. Read more about how alerting in Grafana works [here]({{< relref "../../alerting/rules.md" >}}).

{{< docs-imagebox img="/img/docs/v60/azuremonitor-alerting.png" class="docs-image--no-shadow" caption="Azure Monitor Alerting" >}}

## Querying the Application Insights Service

{{< docs-imagebox img="/img/docs/v60/appinsights-service-query-editor.png" class="docs-image--no-shadow" caption="Application Insights Query Editor" >}}

### Formatting Legend Keys with Aliases for the Application Insights Service

The default legend formatting is:

`metric/name{group/by="groupbyvalue"}`

In the Legend Format field, the aliases which are defined below can be combined any way you want.

Application Insights Examples:

- `server: {{groupbyvalue}}`
- `city: {{groupbyvalue}}`
- `{{groupbyname}}: {{groupbyvalue}}`

### Alias Patterns for Application Insights

- `{{groupbyvalue}}` = replaced with the value of the group by
- `{{groupbyname}}` = replaced with the name/label of the group by
- `{{metric}}` = replaced with metric name (e.g. requests/count)

### Filter Expressions for Application Insights

The filter field takes an OData filter expression.

Examples:

- `client/city eq 'Boydton'`
- `client/city ne 'Boydton'`
- `client/city ne 'Boydton' and client/city ne 'Dublin'`
- `client/city eq 'Boydton' or client/city eq 'Dublin'`

### Templating with Variables for Application Insights

Use the one of the following queries in the `Query` field in the Variable edit view.

Check out the [Templating]({{< relref "../../reference/templating.md" >}}) documentation for an introduction to the templating feature and the different
types of template variables.

| Name                               | Description                                                |
| ---------------------------------- | ---------------------------------------------------------- |
| _AppInsightsMetricNames()_         | Returns a list of metric names.                            |
| _AppInsightsGroupBys(aMetricName)_ | Returns a list of group bys for the specified metric name. |

Examples:

- Metric Names query: `AppInsightsMetricNames()`
- Passing in metric name variable: `AppInsightsGroupBys(requests/count)`
- Chaining template variables: `AppInsightsGroupBys($metricnames)`

{{< docs-imagebox img="/img/docs/v60/appinsights-service-variables.png" class="docs-image--no-shadow" caption="Nested Application Insights Template Variables" >}}

### Application Insights Alerting

Grafana alerting is supported for Application Insights. This is not Azure Alerts support. Read more about how alerting in Grafana works [here]({{< relref "../../alerting/rules.md" >}}).

{{< docs-imagebox img="/img/docs/v60/azuremonitor-alerting.png" class="docs-image--no-shadow" caption="Azure Monitor Alerting" >}}

## Querying the Azure Log Analytics Service

Queries are written in the new [Azure Log Analytics (or KustoDB) Query Language](https://docs.loganalytics.io/index). A Log Analytics Query can be formatted as Time Series data or as Table data.

Time Series queries are for the Graph Panel (and other panels like the Single Stat panel) and must contain a datetime column, a metric name column and a value column. Here is an example query that returns the aggregated count grouped by the Category column and grouped by hour:

```
AzureActivity
| where $__timeFilter(TimeGenerated)
| summarize count() by Category, bin(TimeGenerated, 1h)
| order by TimeGenerated asc
```

Table queries are mainly used in the Table panel and row a list of columns and rows. This example query returns rows with the 6 specified columns:

```
AzureActivity
| where $__timeFilter()
| project TimeGenerated, ResourceGroup, Category, OperationName, ActivityStatus, Caller
| order by TimeGenerated desc
```

If your credentials give you access to multiple subscriptions then choose the appropriate subscription first.

{{< docs-imagebox img="/img/docs/v60/azureloganalytics-service-query-editor.png" class="docs-image--no-shadow" caption="Azure Log Analytics Query Editor" >}}

### Azure Log Analytics Macros

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

  If using the `All` option, then check the `Include All Option` checkbox and in the `Custom all value` field type in the following value: `all`. If `$myVar` has value `all` then the macro will instead expand to `1 == 1`. For template variables with a lot of options, this will increase the query performance by not building a large where..in clause.

### Azure Log Analytics Builtin Variables

There are also some Grafana variables that can be used in Azure Log Analytics queries:

- `$__interval` - Grafana calculates the minimum time grain that can be used to group by time in queries. More details on how it works [here]({{< relref "../../reference/templating.md#interval-variables" >}}). It returns a time grain like `5m` or `1h` that can be used in the bin function. E.g. `summarize count() by bin(TimeGenerated, $__interval)`

### Templating with Variables for Azure Log Analytics

Any Log Analytics query that returns a list of values can be used in the `Query` field in the Variable edit view. There is also one Grafana function for Log Analytics that returns a list of workspaces.

Refer to the [Variables]({{< relref "../../reference/templating.md" >}}) documentation for an introduction to the templating feature and the different
types of template variables.

| Name                                               | Description                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| _workspaces()_                                     | Returns a list of workspaces for the default subscription.                                             |
| _workspaces(12345678-aaaa-bbbb-cccc-123456789aaa)_ | Returns a list of workspaces for the specified subscription (the parameter can be quoted or unquoted). |

Example variable queries:

<!-- prettier-ignore-start -->
| Query                                                                                   | Description                                               |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| _subscriptions()_                                                                       | Returns a list of Azure subscriptions                     |
| _workspaces()_                                                                          | Returns a list of workspaces for default subscription     |
| _workspaces("12345678-aaaa-bbbb-cccc-123456789aaa")_                                    | Returns a list of workspaces for a specified subscription |
| _workspaces("$subscription")_                                                           | With template variable for the subscription parameter     |
| _workspace("myWorkspace").Heartbeat \| distinct Computer_                               | Returns a list of Virtual Machines                        |
| _workspace("$workspace").Heartbeat \| distinct Computer_                                | Returns a list of Virtual Machines with template variable |
| _workspace("$workspace").Perf \| distinct ObjectName_                                   | Returns a list of objects from the Perf table             |
| _workspace("$workspace").Perf \| where ObjectName == "$object" \| distinct CounterName_ | Returns a list of metric names from the Perf table        |

<!-- prettier-ignore-end -->

Example of a time series query using variables:

```
Perf
| where ObjectName == "$object" and CounterName == "$metric"
| where TimeGenerated >= $__timeFrom() and TimeGenerated <= $__timeTo()
| where  $__contains(Computer, $computer)
| summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer
| order by TimeGenerated asc
```

### Azure Log Analytics Alerting

Not implemented yet.

### Writing Analytics Queries For the Application Insights Service

If you change the service type to "Application Insights", the menu icon to the right adds another option, "Toggle Edit Mode". Once clicked, the query edit mode changes to give you a full text area in which to write log analytics queries. (This is identical to how the InfluxDB data source lets you write raw queries.)

Once a query is written, the column names are automatically parsed out of the response data. You can then select them in the "X-axis", "Y-axis", and "Split On" dropdown menus, or just type them out.

There are some important caveats to remember:

- You'll want to order your y-axis in the query, eg. `order by timestamp asc`. The graph may come out looking bizarre otherwise. It's better to have Microsoft sort it on their side where it's faster, than to implement this in the plugin.

- If you copy a log analytics query, typically they'll end with a render instruction, like `render barchart`. This is unnecessary, but harmless.

- Currently, four default dashboard variables are supported: `$__timeFilter()`, `$__from`, `$__to`, and `$__interval`. If you're searching in timestamped data, replace the beginning of your where clause to `where $__timeFilter()`. Dashboard changes by time region are handled as you'd expect, as long as you leave the name of the `timestamp` column alone. Likewise, `$__interval` will automatically change based on the dashboard's time region _and_ the width of the chart being displayed. Use it in bins, so `bin(timestamp,$__interval)` changes into something like `bin(timestamp,1s)`. Use `$__from` and `$__to` if you just want the formatted dates to be inserted.

- Templated dashboard variables are not yet supported! They will come in a future version.
