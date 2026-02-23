---
aliases:
  - ../../data-sources/azure-monitor/alerting/
description: Set up alerts using Azure Monitor data in Grafana
keywords:
  - grafana
  - azure
  - monitor
  - alerting
  - alerts
  - metrics
  - logs
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Alerting
title: Azure Monitor alerting
weight: 500
---

# Azure Monitor alerting

The Azure Monitor data source supports [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/) and [Grafana-managed recording rules](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/), allowing you to create alert rules based on Azure metrics, logs, traces, and resource data. You can monitor your Azure environment and receive notifications when specific conditions are met.

## Before you begin

- Ensure you have the appropriate permissions to create alert rules in Grafana.
- Verify your Azure Monitor data source is configured and working correctly.
- Familiarize yourself with [Grafana Alerting concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/).
- **Important**: Verify your data source uses a supported authentication method. Refer to [Authentication requirements](#authentication-requirements).

## Supported query types for alerting

All Azure Monitor query types support alerting and recording rules:

| Query type           | Use case                                           | Notes                                                    |
| -------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| Metrics              | Threshold-based alerts on Azure resource metrics   | Best suited for alerting; returns time-series data       |
| Logs                 | Alert on log patterns, error counts, or thresholds | Use KQL to aggregate data into numeric values            |
| Azure Resource Graph | Alert on resource state or configuration changes   | Use count aggregations to return numeric data            |
| Traces               | Alert on trace data and application performance    | Use aggregations to return numeric values for evaluation |

{{< admonition type="note" >}}
Alert queries must return numeric data that Grafana can evaluate against a threshold. Queries that return only text or non-numeric data cannot be used directly for alerting.
{{< /admonition >}}

## Authentication requirements

Alerting and recording rules run as background processes without a user context. This means they require service-level authentication and don't work with all authentication methods.

| Authentication method            | Supported                             |
| -------------------------------- | ------------------------------------- |
| App Registration (client secret) | ✓                                     |
| Managed Identity                 | ✓                                     |
| Workload Identity                | ✓                                     |
| Current User                     | ✓ (with fallback service credentials) |

{{< admonition type="note" >}}
If you use **Current User** authentication, you must configure **fallback service credentials** for alerting and recording rules to function. User credentials aren't available for background operations, so Grafana uses the fallback credentials instead. Refer to [configure the data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/configure/) for details on setting up fallback credentials.
{{< /admonition >}}

## Create an alert rule

To create an alert rule using Azure Monitor data:

1. Go to **Alerting** > **Alert rules**.
1. Click **New alert rule**.
1. Enter a name for your alert rule.
1. In the **Define query and alert condition** section:
   - Select your Azure Monitor data source.
   - Configure your query (for example, a Metrics query for CPU usage or a Logs query using KQL).
   - Add a **Reduce** expression if your query returns multiple series.
   - Add a **Threshold** expression to define the alert condition.
1. Configure the **Set evaluation behavior**:
   - Select or create a folder and evaluation group.
   - Set the evaluation interval (how often the alert is checked).
   - Set the pending period (how long the condition must be true before firing).
1. Add labels and annotations to provide context for notifications.
1. Click **Save rule**.

For detailed instructions, refer to [Create a Grafana-managed alert rule](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/).

## Example: VM CPU usage alert

This example creates an alert that fires when virtual machine CPU usage exceeds 80%:

1. Create a new alert rule.
1. Configure the query:
   - **Service**: Metrics
   - **Resource**: Select your virtual machine
   - **Metric namespace**: `Microsoft.Compute/virtualMachines`
   - **Metric**: `Percentage CPU`
   - **Aggregation**: `Average`
1. Add expressions:
   - **Reduce**: Last (to get the most recent data point)
   - **Threshold**: Is above 80
1. Set evaluation to run every 1 minute with a 5-minute pending period.
1. Save the rule.

## Example: Error log count alert

This example alerts when error logs exceed a threshold using a KQL query:

1. Create a new alert rule.
1. Configure the query:
   - **Service**: Logs
   - **Resource**: Select your Log Analytics workspace
   - **Query**:
     ```kusto
     AppExceptions
     | where TimeGenerated > ago(5m)
     | summarize ErrorCount = count() by bin(TimeGenerated, 1m)
     ```
1. Add expressions:
   - **Reduce**: Max (to get the highest count in the period)
   - **Threshold**: Is above 10
1. Set evaluation to run every 5 minutes.
1. Save the rule.

## Example: Resource count alert

This example alerts when the number of running virtual machines drops below a threshold using Azure Resource Graph:

1. Create a new alert rule.
1. Configure the query:
   - **Service**: Azure Resource Graph
   - **Subscriptions**: Select your subscriptions
   - **Query**:

     ```kusto
     resources
     | where type == "microsoft.compute/virtualmachines"
     | where properties.extended.instanceView.powerState.displayStatus == "VM running"
     | summarize RunningVMs = count()
     ```

1. Add expressions:
   - **Reduce**: Last
   - **Threshold**: Is below 3
1. Set evaluation to run every 5 minutes.
1. Save the rule.

## Best practices

Follow these recommendations to create reliable and efficient alerts with Azure Monitor data.

### Use appropriate query intervals

- Set the alert evaluation interval to be greater than or equal to the minimum data resolution from Azure Monitor.
- Azure Monitor Metrics typically have 1-minute granularity at minimum.
- Avoid very short intervals (less than 1 minute) as they may cause evaluation timeouts or miss data points.

### Reduce multiple series

When your Azure Monitor query returns multiple time series (for example, CPU usage across multiple VMs), use the **Reduce** expression to aggregate them:

- **Last**: Use the most recent value
- **Mean**: Average across all series
- **Max/Min**: Use the highest or lowest value
- **Sum**: Total across all series

### Optimize Log Analytics queries

For Logs queries used in alerting:

- Use `summarize` to aggregate data into numeric values.
- Include appropriate time filters using `ago()` or `TimeGenerated`.
- Avoid returning large result sets; aggregate data in the query.
- Test queries in Explore before using them in alert rules.

### Handle no data conditions

Configure what happens when no data is returned:

1. In the alert rule, find **Configure no data and error handling**.
1. Choose an appropriate action:
   - **No Data**: Keep the alert in its current state
   - **Alerting**: Treat no data as an alert condition
   - **OK**: Treat no data as a healthy state

### Test queries before alerting

Always verify your query returns expected data before creating an alert:

1. Go to **Explore**.
1. Select your Azure Monitor data source.
1. Run the query you plan to use for alerting.
1. Confirm the data format and values are correct.
1. Verify the query returns numeric data suitable for threshold evaluation.

## Troubleshooting

If your Azure Monitor alerts aren't working as expected, use the following sections to diagnose and resolve common issues.

### Alerts not firing

- Verify the data source uses a supported authentication method. If using Current User authentication, ensure fallback service credentials are configured.
- Check that the query returns numeric data in Explore.
- Ensure the evaluation interval allows enough time for data to be available.
- Review the alert rule's health and any error messages in the Alerting UI.

### Authentication errors in alert evaluation

If you see authentication errors when alerts evaluate:

- Confirm the data source is configured with App Registration, Managed Identity, Workload Identity, or Current User with fallback service credentials.
- If using App Registration, verify the client secret hasn't expired.
- If using Current User, verify that fallback service credentials are configured and valid.
- Check that the service principal has appropriate permissions on Azure resources.

### Query timeout errors

- Simplify complex KQL queries.
- Reduce the time range in Log Analytics queries.
- Add more specific filters to narrow result sets.

For additional troubleshooting help, refer to [Troubleshoot Azure Monitor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/troubleshooting/).

## Additional resources

- [Grafana Alerting documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/)
- [Create alert rules](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/)
- [Azure Monitor query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/query-editor/)
- [Grafana-managed recording rules](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/)
