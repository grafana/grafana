---
aliases:
  - ../../data-sources/aws-cloudwatch/alerting/
description: Set up alerts using Amazon CloudWatch data in Grafana
keywords:
  - grafana
  - aws
  - cloudwatch
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
title: Amazon CloudWatch alerting
weight: 460
review_date: 2026-06-23
---

# Amazon CloudWatch alerting

The Amazon CloudWatch data source supports [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/). You can create alert rules on CloudWatch metrics and CloudWatch Logs, so Grafana notifies you when a metric crosses a threshold or when a log query returns a value that meets your alert condition.

This is Grafana Alerting evaluated by Grafana, not CloudWatch alarms. To visualize the history of existing CloudWatch alarms instead, refer to [Amazon CloudWatch annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/annotations/).

## Before you begin

Before you create alert rules with CloudWatch data, ensure you have:

- A [configured Amazon CloudWatch data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/configure/).
- Permissions to create alert rules in Grafana.
- Familiarity with [Grafana Alerting concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/).

## Supported query types for alerting

Alert rules require queries that return numeric data that Grafana can evaluate against a threshold. CloudWatch supports alerting for the following query types:

| Query type | Use case | Notes |
| --- | --- | --- |
| Metrics | Threshold-based alerts on CloudWatch metrics | Returns time series data; best suited for alerting. |
| Logs | Alert on log patterns, error counts, or thresholds | Use the `stats` command to aggregate logs into numeric values. |

{{< admonition type="note" >}}
You can't create an alert rule from a metric math expression that references another query, such as `queryA * 2`. Define the metric directly in the alert query instead.
{{< /admonition >}}

## Create an alert rule

To create an alert rule using CloudWatch data:

1. Go to **Alerting** > **Alert rules**.
1. Click **New alert rule**.
1. Enter a name for your alert rule.
1. In the **Define query and alert condition** section:
   - Select your Amazon CloudWatch data source.
   - Configure your query, for example, a Metrics query for `CPUUtilization` or a Logs query that uses the `stats` command.
   - Add a **Reduce** expression if your query returns multiple series.
   - Add a **Threshold** expression to define the alert condition.
1. Configure the **Set evaluation behavior** section:
   - Select or create a folder and evaluation group.
   - Set the evaluation interval.
   - Set the pending period.
1. Add labels and annotations to provide context for notifications.
1. Click **Save rule**.

For detailed instructions, refer to [Create a Grafana-managed alert rule](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/).

## Example: metric threshold alert

This example fires when average EC2 CPU utilization exceeds 80%:

1. Create a new alert rule.
1. Configure the query:
   - **Namespace**: `AWS/EC2`
   - **Metric name**: `CPUUtilization`
   - **Statistic**: `Average`
   - **Dimensions**: `InstanceId`
1. Add expressions:
   - **Reduce**: Last, to get the most recent data point.
   - **Threshold**: Is above 80.
1. Set evaluation to run every 1 minute with a 5-minute pending period.
1. Save the rule.

## Example: log error count alert

This example alerts when the number of log entries that contain `Exception` exceeds a threshold. CloudWatch Logs alerting requires a query that returns numeric data, which you can produce with the `stats` command:

1. Create a new alert rule.
1. Configure the query:
   - Select **CloudWatch Logs** as the query mode.
   - Select the region and log groups to query.
   - Enter the following query:

     ```
     filter @message like /Exception/
         | stats count(*) as exceptionCount by bin(5m)
     ```

1. Add expressions:
   - **Reduce**: Max, to get the highest count in the period.
   - **Threshold**: Is above 10.
1. Set evaluation to run every 5 minutes.
1. Save the rule.

{{< admonition type="note" >}}
If you receive an error such as `input data must be a wide series but got ...`, make sure your query returns numeric data that can render in a time series panel.
{{< /admonition >}}

## CloudWatch Logs timeouts during alert evaluation

For CloudWatch Logs queries, Grafana polls AWS until the query completes or a timeout is reached. During alert evaluation, the timeout defined in the [Grafana configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/) takes precedence over the **Query Result Timeout** setting on the data source. Set the configuration timeout high enough for your log queries to finish.

## Best practices

Follow these recommendations to create reliable alerts with CloudWatch data.

### Test queries before alerting

Verify your query returns numeric data before you create an alert:

1. Go to **Explore**.
1. Select your Amazon CloudWatch data source.
1. Run the query you plan to use for alerting.
1. Confirm the result is numeric and suitable for threshold evaluation.

### Reduce multiple series

When a query returns multiple time series, use the **Reduce** expression to aggregate them into a single value with **Last**, **Mean**, **Max**, **Min**, or **Sum**.

### Handle no data conditions

Configure how the rule behaves when no data is returned under **Configure no data and error handling**. Choose **No Data**, **Alerting**, or **OK** based on whether missing data should be treated as a problem.

## Troubleshoot alerting

If your CloudWatch alerts don't work as expected, use the following sections to diagnose common issues.

### Alerts don't fire

- Confirm the query returns numeric data in Explore.
- Ensure the evaluation interval allows enough time for data to be available.
- Review the alert rule's health and any error messages in the Alerting UI.

### Log query alerts time out

- Increase the Grafana configuration file timeout, which takes precedence during alert evaluation.
- Narrow the time range or add filters to reduce the volume of data the query scans.

For more help, refer to [Troubleshoot Amazon CloudWatch](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/troubleshooting/).

## Related resources

- [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/)
- [Create a Grafana-managed alert rule](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/)
- [Amazon CloudWatch query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/query-editor/)
