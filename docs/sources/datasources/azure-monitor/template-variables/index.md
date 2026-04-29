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
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Template variables
title: Azure Monitor template variables
weight: 400
last_reviewed: 2025-12-04
---

# Azure Monitor template variables

Instead of hard-coding details such as resource group or resource name values in metric queries, you can use variables.
This helps you create more interactive, dynamic, and reusable dashboards.
Grafana refers to such variables as template variables.

For an introduction to templating and template variables, refer to the [Templating](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) and [Add and manage variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/).

## Before you begin

- Ensure you have [configured the Azure Monitor data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/configure/).
- If you want template variables to auto-populate subscriptions, set a **Default Subscription** in the data source configuration.

## Create a template variable

To create a template variable for Azure Monitor:

1. Open the dashboard where you want to add the variable.
1. Click **Dashboard settings** (gear icon) in the top navigation.
1. Select **Variables** in the left menu.
1. Click **Add variable**.
1. Enter a **Name** for your variable (e.g., `subscription`, `resourceGroup`, `resource`).
1. In the **Type** dropdown, select **Query**.
1. In the **Data source** dropdown, select your Azure Monitor data source.
1. In the **Query Type** dropdown, select the appropriate query type (see [Available query types](#available-query-types)).
1. Configure any additional fields required by the selected query type.
1. Click **Run query** to preview the variable values.
1. Configure display options such as **Multi-value** or **Include All option** as needed.
1. Click **Apply** to save the variable.

## Available query types

The Azure Monitor data source provides the following query types for template variables:

| Query type              | Description                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Subscriptions**       | Returns a list of Azure subscriptions accessible to the configured credentials.                                                        |
| **Resource Groups**     | Returns resource groups for a specified subscription. Supports multi-value selection.                                                  |
| **Namespaces**          | Returns metric namespaces for the specified subscription. If a resource group is specified, returns only namespaces within that group. |
| **Regions**             | Returns Azure regions available for the specified subscription.                                                                        |
| **Resource Names**      | Returns resource names for a specified subscription, resource group, and namespace. Supports multi-value selection.                    |
| **Metric Names**        | Returns available metric names for a specified resource.                                                                               |
| **Workspaces**          | Returns Log Analytics workspaces for the specified subscription.                                                                       |
| **Logs**                | Executes a KQL query and returns the results as variable values. See [Create a Logs variable](#create-a-logs-variable).                |
| **Custom Namespaces**   | Returns custom metric namespaces for a specified resource.                                                                             |
| **Custom Metric Names** | Returns custom metric names for a specified resource.                                                                                  |

{{< admonition type="note" >}}
Custom metrics cannot be emitted against a subscription or resource group. Select specific resources when retrieving custom metric namespaces or custom metric names.
{{< /admonition >}}

## Create cascading variables

Cascading variables (also called dependent or chained variables) allow you to create dropdown menus that filter based on previous selections. This is useful for drilling down from subscription to resource group to specific resource.

### Example: Subscription → Resource Group → Resource Name

**Step 1: Create a Subscription variable**

1. Create a variable named `subscription`.
1. Set **Query Type** to **Subscriptions**.

**Step 2: Create a Resource Group variable**

1. Create a variable named `resourceGroup`.
1. Set **Query Type** to **Resource Groups**.
1. In the **Subscription** field, select `$subscription`.

**Step 3: Create a Resource Name variable**

1. Create a variable named `resource`.
1. Set **Query Type** to **Resource Names**.
1. In the **Subscription** field, select `$subscription`.
1. In the **Resource Group** field, select `$resourceGroup`.
1. Select the appropriate **Namespace** for your resources (e.g., `Microsoft.Compute/virtualMachines`).

Now when you change the subscription, the resource group dropdown updates automatically, and when you change the resource group, the resource name dropdown updates.

## Create a Logs variable

The **Logs** query type lets you use a KQL query to populate variable values. The query must return a single column of values.

**To create a Logs variable:**

1. Create a new variable with **Query Type** set to **Logs**.
1. Select a **Resource** (Log Analytics workspace or Application Insights resource).
1. Enter a KQL query that returns a single column.

### Logs variable query examples

| Query                                     | Returns                               |
| ----------------------------------------- | ------------------------------------- |
| `Heartbeat \| distinct Computer`          | List of virtual machine names         |
| `Perf \| distinct ObjectName`             | List of performance object names      |
| `AzureActivity \| distinct ResourceGroup` | List of resource groups with activity |
| `AppRequests \| distinct Name`            | List of application request names     |

You can reference other variables in your Logs query:

```kusto
workspace("$workspace").Heartbeat | distinct Computer
```

```kusto
workspace("$workspace").Perf
| where ObjectName == "$object"
| distinct CounterName
```

## Variable refresh options

Control when your variables refresh by setting the **Refresh** option:

| Option                   | Behavior                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| **On dashboard load**    | Variables refresh each time the dashboard loads. Best for data that changes infrequently. |
| **On time range change** | Variables refresh when the dashboard time range changes. Use for time-sensitive queries.  |

For dashboards with many variables or complex queries, use **On dashboard load** to improve performance.

## Use variables in queries

After you create template variables, you can use them in your Azure Monitor queries by referencing them with the `$` prefix.

### Metrics query example

In a Metrics query, select your variables in the resource picker fields:

- **Subscription**: `$subscription`
- **Resource Group**: `$resourceGroup`
- **Resource Name**: `$resource`

### Logs query example

Reference variables directly in your KQL queries:

```kusto
Perf
| where ObjectName == "$object" and CounterName == "$metric"
| where TimeGenerated >= $__timeFrom() and TimeGenerated <= $__timeTo()
| where $__contains(Computer, $computer)
| summarize avg(CounterValue) by bin(TimeGenerated, $__interval), Computer
| order by TimeGenerated asc
```

## Multi-value variables

You can enable **Multi-value** selection for **Resource Groups** and **Resource Names** variables. When using multi-value variables in a Metrics query, all selected resources must:

- Belong to the same subscription
- Be in the same Azure region
- Be of the same resource type (namespace)

{{< admonition type="note" >}}
When a multi-value variable is used as a parameter in another variable query (for example, to retrieve metric names), only the first selected value is used. Ensure the first resource group and resource name combination is valid.
{{< /admonition >}}

## Troubleshoot template variables

If you encounter issues with template variables, try the following solutions.

### Variable returns no values

- Verify the Azure Monitor data source is configured correctly and can connect to Azure.
- Check that the credentials have appropriate permissions to list the requested resources.
- For cascading variables, ensure parent variables have valid selections.

### Variable values are outdated

- Check the **Refresh** setting and adjust if needed.
- Click the refresh icon next to the variable dropdown to manually refresh.

### Multi-value selection not working in queries

- Ensure the resources meet the requirements (same subscription, region, and type).
- For Logs queries, use the `$__contains()` macro to handle multi-value variables properly.
