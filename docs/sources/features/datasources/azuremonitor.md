+++
title = "Using Azure Monitor in Grafana"
description = "Guide for using Azure Monitor in Grafana"
keywords = ["grafana", "microsoft", "azure", "monitor", "application", "insights", "log", "analytics", "guide"]
type = "docs"
aliases = ["/datasources/azuremonitor"]
[menu.docs]
name = "Azure Monitor"
parent = "datasources"
weight = 5
+++

# Using Azure Monitor in Grafana

> Officially released in Grafana v6.0.0

As of Grafana 6.0, the Azure Monitor plugin has been moved into Grafana so it now ships with built-in support for Azure Monitor.

The Azure Monitor Datasource supports multiple services in the Azure cloud:

- **[Azure Monitor]({{< relref "#querying-the-azure-monitor-service" >}})** is the platform service that provides a single source for monitoring Azure resources.
- **[Application Insights]({{< relref "#querying-the-application-insights-service" >}})** is an extensible Application Performance Management (APM) service for web developers on multiple platforms and can be used to monitor your live web application - it will automatically detect performance anomalies.
- **[Azure Log Analytics]({{< relref "#querying-the-azure-log-analytics-service" >}})** (or Azure Logs) gives you access to log data collected by Azure Monitor.
- **[Application Insights Analytics]({{< relref "#writing-analytics-queries-for-the-application-insights-service" >}})** allows you to query [Application Insights data](https://docs.microsoft.com/en-us/azure/azure-monitor/app/analytics) using the same query language used for Azure Log Analytics.

## Adding the data source to Grafana

The datasource can access metrics from four different services. You can configure access to the services that you use. It is also possible to use the same credentials for multiple services if that is how you have set it up in Azure AD.

- [Guide to setting up an Azure Active Directory Application for Azure Monitor.](https://docs.microsoft.com/en-us/azure/azure-resource-manager/resource-group-create-service-principal-portal)
- [Guide to setting up an Azure Active Directory Application for Azure Log Analytics.](https://dev.loganalytics.io/documentation/Authorization/AAD-Setup)
- [Quickstart Guide for Application Insights.](https://dev.applicationinsights.io/quickstart/)

1. Accessed from the Grafana main menu, newly installed data sources can be added immediately within the Data Sources section. Next, click the  "Add data source" button in the upper right. The data source will be available for selection in the Type select box.

2. Select Azure Monitor from the Type dropdown:<br/>
![Data Source Type](https://raw.githubusercontent.com/grafana/azure-monitor-datasource/master/src/img/config_1_select_type.png)
3. In the name field, fill in a name for the data source. It can be anything. Some suggestions are Azure Monitor or App Insights.

4. If you are using Azure Monitor, then you need 4 pieces of information from the Azure portal (see link above for detailed instructions):
    - **Tenant Id** (Azure Active Directory -> Properties -> Directory ID)
    - **Subscription Id** (Subscriptions -> Choose subscription -> Overview -> Subscription ID)
    - **Client Id** (Azure Active Directory -> App Registrations -> Choose your app -> Application ID)
    - **Client Secret** ( Azure Active Directory -> App Registrations -> Choose your app -> Keys)

5. Paste these four items into the fields in the Azure Monitor API Details section:<br/>
![Azure Monitor API Details](https://raw.githubusercontent.com/grafana/azure-monitor-datasource/master/src/img/config_2_azure_monitor_api_details.png)

6. If you are also using the Azure Log Analytics service, then you need to specify these two config values (or you can reuse the Client Id and Secret from the previous step).
    - Client Id (Azure Active Directory -> App Registrations -> Choose your app -> Application ID)
    - Client Secret ( Azure Active Directory -> App Registrations -> Choose your app -> Keys -> Create a key -> Use client secret)

7. If you are are using  Application Insights, then you need two pieces of information from the Azure Portal (see link above for detailed instructions):
    - Application ID
    - API Key

8. Paste these two items into the appropriate fields in the Application Insights API Details section:<br/>
![Application Insights API Details](https://raw.githubusercontent.com/grafana/azure-monitor-datasource/master/src/img/config_3_app_insights_api_details.png)

9. Test that the configuration details are correct by clicking on the "Save & Test" button:<br/>
![Azure Monitor API Details](https://raw.githubusercontent.com/grafana/azure-monitor-datasource/master/src/img/config_4_save_and_test.png)

Alternatively on step 4 if creating a new Azure Active Directory App, use the [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/?view=azure-cli-latest):

```bash
az ad sp create-for-rbac -n "http://localhost:3000"
```

## Choose a Service

In the query editor for a panel, after choosing your Azure Monitor datasource, the first option is to choose a service. There are three options here: Azure Monitor, Application Insights and Azure Log Analytics. The query editor will change depending on which one you pick. Azure Monitor is the default.

## Querying the Azure Monitor Service

The Azure Monitor service provides metrics for all the Azure services that you have running. It helps you understand how your applications on Azure are performing and to proactively find issues affecting your applications.

Examples of metrics that you can get from the service are:

- Microsoft.Compute/virtualMachines - Percentage CPU
- Microsoft.Network/networkInterfaces - Bytes sent
- Microsoft.Storage/storageAccounts - Used Capacity

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

The Azure Monitor Datasource Plugin provides the following queries you can specify in the `Query` field in the Variable edit view. They allow you to fill a variable's options list.

| Name                                                     | Description                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------- |
| *ResourceGroups()*                                       | Returns a list of resource groups.                             |
| *Namespaces(aResourceGroup)*                             | Returns a list of namespaces for the specified resource group. |
| *ResourceNames(aResourceGroup, aNamespace)*              | Returns a list of resource names.                              |
| *MetricNames(aResourceGroup, aNamespace, aResourceName)* | Returns a list of metric names.                                |

Examples:

- Resource Groups query: `ResourceGroups()`
- Passing in metric name variable: `Namespaces(cosmo)`
- Chaining template variables: `ResourceNames($rg, $ns)`
- Do not quote parameters: `MetricNames(hg, Microsoft.Network/publicIPAddresses, grafanaIP)`

{{< docs-imagebox img="/img/docs/v60/azuremonitor-service-variables.png" class="docs-image--no-shadow" caption="Nested Azure Monitor Template Variables" >}}

Checkout the [Templating]({{< relref "reference/templating.md" >}}) documentation for an introduction to the templating feature and the different
types of template variables.

### Azure Monitor Metrics Whitelist

Not all metrics returned by the Azure Monitor API have values. The Grafana datasource has a whitelist to only return metric names if it is possible they might have values. This whitelist is updated regularly as new services and metrics are added to the Azure cloud. You can find the current whitelist [here](https://github.com/grafana/grafana/blob/master/public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_monitor/supported_namespaces.ts).

### Azure Monitor Alerting

Grafana alerting is supported for the Azure Monitor service. This is not Azure Alerts support. Read more about how alerting in Grafana works [here]({{< relref "alerting/rules.md" >}}).

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

Checkout the [Templating]({{< relref "reference/templating.md" >}}) documentation for an introduction to the templating feature and the different
types of template variables.

| Name                               | Description                                                |
| ---------------------------------- | ---------------------------------------------------------- |
| *AppInsightsMetricNames()*         | Returns a list of metric names.                            |
| *AppInsightsGroupBys(aMetricName)* | Returns a list of group bys for the specified metric name. |

Examples:

- Metric Names query: `AppInsightsMetricNames()`
- Passing in metric name variable: `AppInsightsGroupBys(requests/count)`
- Chaining template variables: `AppInsightsGroupBys($metricnames)`

{{< docs-imagebox img="/img/docs/v60/appinsights-service-variables.png" class="docs-image--no-shadow" caption="Nested Application Insights Template Variables" >}}

### Application Insights Alerting

Not implemented yet.

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

{{< docs-imagebox img="/img/docs/v60/azureloganalytics-service-query-editor.png" class="docs-image--no-shadow" caption="Azure Log Analytics Query Editor" >}}

### Azure Log Analytics Macros

To make writing queries easier there are several Grafana macros that can be used in the where clause of a query:

- `$__timeFilter()` - Expands to
    `TimeGenerated ≥ datetime(2018-06-05T18:09:58.907Z) and`
    `TimeGenerated ≤ datetime(2018-06-05T20:09:58.907Z)` where the from and to datetimes are from the Grafana time picker.

- `$__timeFilter(datetimeColumn)` - Expands to
    `datetimeColumn  ≥ datetime(2018-06-05T18:09:58.907Z) and`
    `datetimeColumn ≤ datetime(2018-06-05T20:09:58.907Z)` where the from and to datetimes are from the Grafana time picker.

- `$__escapeMulti($myVar)` - is to be used with multi-value template variables that contains illegal characters. If $myVar has the value  `'\\grafana-vm\Network(eth0)\Total','\\hello!'`, it expands to: `@'\\grafana-vm\Network(eth0)\Total', @'\\hello!'`. If using single value variables there no need for this macro, simply escape the variable inline instead - `@'\$myVar'`

- `$__contains(colName, $myVar)` - is to be used with multi-value template variables. If $myVar has the value `'value1','value2'`, it expands to: `colName in ('value1','value2')`.

     If using the `All` option, then check the `Include All Option` checkbox and in the `Custom all value` field type in the following value: `all`. If $myVar has value `all` then the macro will instead expand to `1 == 1`. For template variables with a lot of options, this will increase the query performance by not building a large where..in clause.

### Azure Log Analytics Builtin Variables

There are also some Grafana variables that can be used in Azure Log Analytics queries:

- `$__from` - Returns the From datetime from the Grafana picker. Example: `datetime(2018-06-05T18:09:58.907Z)`.
- `$__to` - Returns the From datetime from the Grafana picker. Example: `datetime(2018-06-05T20:09:58.907Z)`.
- `$__interval` - Grafana calculates the minimum time grain that can be used to group by time in queries. More details on how it works [here]({{< relref "reference/templating.md#interval-variables" >}}). It returns a time grain like `5m` or `1h` that can be used in the bin function. E.g. `summarize count() by bin(TimeGenerated, $__interval)`

### Azure Log Analytics Alerting

Not implemented yet.

### Writing Analytics Queries For the Application Insights Service

If you change the service type to "Application Insights", the menu icon to the right adds another option, "Toggle Edit Mode". Once clicked, the query edit mode changes to give you a full text area in which to write log analytics queries. (This is identical to how the InfluxDB datasource lets you write raw queries.)

Once a query is written, the column names are automatically parsed out of the response data. You can then select them in the "X-axis", "Y-axis", and "Split On" dropdown menus, or just type them out.

There are some important caveats to remember:

- You'll want to order your y-axis in the query, eg. `order by timestamp asc`. The graph may come out looking bizarre otherwise. It's better to have Microsoft sort it on their side where it's faster, than to implement this in the plugin.

- If you copy a log analytics query, typically they'll end with a render instruction, like `render barchart`. This is unnecessary, but harmless.

- Currently, four default dashboard variables are supported: `$__timeFilter()`, `$__from`, `$__to`, and `$__interval`. If you're searching in timestamped data, replace the beginning of your where clause to `where $__timeFilter()`. Dashboard changes by time region are handled as you'd expect, as long as you leave the name of the `timestamp` column alone. Likewise, `$__interval` will automatically change based on the dashboard's time region _and_ the width of the chart being displayed. Use it in bins, so `bin(timestamp,$__interval)` changes into something like `bin(timestamp,1s)`. Use `$__from` and `$__to` if you just want the formatted dates to be inserted.

- Templated dashboard variables are not yet supported! They will come in a future version.
