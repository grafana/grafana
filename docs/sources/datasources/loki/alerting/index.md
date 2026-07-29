---
aliases:
  - ../../data-sources/loki/alerting/
description: Set up alerts using Loki data in Grafana
keywords:
  - grafana
  - loki
  - logging
  - alerting
  - alerts
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Alerting
title: Loki alerting
weight: 500
review_date: 2026-07-29
---

# Loki alerting

The Loki data source supports [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/). You can alert on your logs so Grafana notifies you when a LogQL metric query crosses a threshold, for example when the rate of error logs spikes.

Loki works with two kinds of alert rules:

- **Grafana-managed alert rules:** Grafana evaluates the rule against a LogQL metric query. This is the most common approach and works with any Loki data source.
- **Data source-managed alert rules:** The Loki ruler stores and evaluates the rule. Use these when you want alert rules to live alongside your Loki deployment. Enable **Manage alert rules in Alerting UI** on the data source to create and edit them from Grafana.

## Before you begin

Before you create alert rules with Loki data, ensure you have:

- A [configured Loki data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure/).
- Permissions to create alert rules in Grafana.
- Familiarity with [Grafana Alerting concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/).
- For data source-managed rules, a Loki deployment with the ruler enabled, and the **Manage alert rules in Alerting UI** setting turned on in the data source configuration. To route the resulting alerts, add a separate [Alertmanager data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/alertmanager/).

## Supported queries for alerting

Alert rules require queries that return numeric data that Grafana can evaluate against a threshold. Wrap a Loki log query in a LogQL metric function, such as `rate` or `count_over_time`, to produce numeric time series.

{{< admonition type="note" >}}
Use a metric query for alerting, not a plain log query. A log query returns log lines, which Grafana can't evaluate against a threshold.
{{< /admonition >}}

The following queries are common starting points for alerting. Replace the label matchers with values from your own logs.

Rate of error lines per second:

```logql
sum(rate({app="my-app"} |= `error` [5m]))
```

Error rate broken down by status code, to alert per endpoint or service:

```logql
sum by (status) (rate({app="nginx"} | logfmt | status=~`5..` [5m]))
```

Count of slow requests, for a latency alert:

```logql
sum(count_over_time({app="my-app"} | logfmt | duration > 1s [5m]))
```

Detect a service that stopped logging by alerting when the count drops to zero:

```logql
sum(count_over_time({app="my-app"} [10m]))
```

## Create a Grafana-managed alert rule

To create a Grafana-managed alert rule using Loki data:

1. Go to **Alerting** > **Alert rules**.
1. Click **New alert rule**.
1. Enter a name for your alert rule.
1. In the **Define query and alert condition** section:
   - Select your Loki data source.
   - Enter a LogQL metric query.
   - Add a **Reduce** expression if your query returns multiple series.
   - Add a **Threshold** expression to define the alert condition.
1. Configure the **Set evaluation behavior** section:
   - Select or create a folder and evaluation group.
   - Set the evaluation interval and pending period.
1. Add labels and annotations to provide context for notifications.
1. Click **Save rule**.

For detailed instructions, refer to [Create a Grafana-managed alert rule](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/).

## Example: alert on error log rate

This example fires when the rate of log lines that contain `error` exceeds a threshold:

1. Create a new alert rule.
1. Configure the query, replacing the label matcher with your own:

   ```logql
   sum(rate({app="my-app"} |= `error` [5m]))
   ```

1. Add expressions:
   - **Reduce**: Last, to get the most recent value.
   - **Threshold**: Is above `10`.
1. Set evaluation to run every 1 minute with a 5-minute pending period.
1. Save the rule.

## Manage data source-managed alert rules

When you turn on **Manage alert rules in Alerting UI** for the Loki data source, you can create and edit alert and recording rules that the Loki ruler stores and evaluates. These rules appear in the Grafana Alerting UI alongside your Grafana-managed rules, grouped under the Loki data source.

The Loki data source configuration doesn't include Alertmanager routing. To route the resulting alerts, add a separate [Alertmanager data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/alertmanager/). For more information, refer to [Configure the Loki data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure/#alerting) and [Data source-managed alert rules](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-data-source-managed-rule/).

## Best practices

Follow these recommendations to create reliable alerts with Loki data.

### Test queries before alerting

Verify your query returns numeric data before you create an alert:

1. Go to **Explore**.
1. Select your Loki data source.
1. Run the LogQL metric query you plan to use for alerting.
1. Confirm the result is numeric and suitable for threshold evaluation.

### Handle no data conditions

Configure how the rule behaves when no data is returned under **Configure no data and error handling**. Choose **No Data**, **Alerting**, or **OK** based on whether missing data should be treated as a problem.

## Troubleshoot alerting

If your Loki alerts don't work as expected, use the following sections to diagnose common issues.

### Alerts don't fire

- Confirm the query is a LogQL metric query that returns numeric data in Explore.
- Ensure the evaluation interval allows enough time for data to be available.
- Review the alert rule's health and any error messages in the Alerting UI.

### Data source-managed rules don't appear

- Confirm **Manage alert rules in Alerting UI** is enabled in the Loki data source configuration.
- Verify the Loki ruler is enabled and reachable from Grafana.

For more help, refer to [Troubleshoot Loki issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/troubleshooting/).

## Related resources

- [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/)
- [Create a Grafana-managed alert rule](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/)
- [Loki query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/query-editor/)
