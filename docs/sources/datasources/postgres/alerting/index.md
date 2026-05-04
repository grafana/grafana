---
description: Set up alerts using PostgreSQL data in Grafana
keywords:
  - grafana
  - postgresql
  - alerting
  - alerts
  - time series
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Alerting
title: PostgreSQL alerting
weight: 500
review_date: 2026-05-04
---

# PostgreSQL alerting

The PostgreSQL data source supports [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/). You can create alert rules that evaluate time series queries against your PostgreSQL database and send notifications when conditions are met.

## Before you begin

- Ensure your [PostgreSQL data source is configured](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/configure/).
- Familiarize yourself with [Alert rules](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/) and [Create a Grafana-managed alert rule](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/).

## Supported query format

Only **time series** queries can be used in alert rule conditions.

- Your query must return a column named `time` (native SQL date/time or UNIX epoch) and one or more numeric value columns.
- **Table** formatted queries aren't supported in alert rule conditions.

For details on writing time series queries, refer to [Time series queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/postgres/query-editor/#time-series-queries) in the PostgreSQL query editor.

## Limitations

Keep the following limitations in mind when using PostgreSQL with Grafana Alerting:

- **Time series format only:** Alert rules require the query **Format** set to **Time series**. Table format queries can't be used as alert conditions.
- **No fill mode in alerts:** The fill parameter in `$__timeGroup` (for example, `$__timeGroup(col, '5m', 0)`) isn't applied during alert evaluation. Missing data points remain as gaps.
- **Single query per condition:** Each alert condition evaluates a single query. If you need to combine results from multiple queries, use [math expressions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/#add-expressions) in the alert rule.
- **Template variables aren't supported:** Alert queries don't support dashboard template variables because alerts evaluate independently of any dashboard context. Hard-code values or use [alert rule labels](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/) instead.

## Create an alert rule

To create an alert rule that uses PostgreSQL:

1. Go to **Alerting** in the left menu and select **Alert rules**.
1. Click **New alert rule**.
1. In the query section, select your **PostgreSQL** data source.
1. Set the query **Format** to **Time series**.
1. Write a SQL query that returns a `time` column and numeric value(s).
1. Configure the condition, evaluation group, and notification settings.
1. Save the rule.

For step-by-step guidance, refer to [Create a Grafana-managed alert rule](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/).

## Example queries for alerting

The following examples show common PostgreSQL alerting patterns.

### Threshold alert

The following query returns a time series suitable for a threshold alert (for example, alert when average value exceeds a limit):

```sql
SELECT
  $__timeGroupAlias("time_date_time", '5m'),
  avg("value_double") AS value
FROM test_data
WHERE $__timeFilter("time_date_time")
GROUP BY time
ORDER BY time
```

Use condition types such as **Is above** or **Is below** in the alert rule to evaluate the series.

### Multi-dimensional alert

To create separate alert instances for each value of a label column, include a string column in your query. Grafana creates one alert instance per unique label value, so you can monitor each host, service, or region independently.

```sql
SELECT
  $__timeGroupAlias("time_date_time", '5m'),
  avg("value_double") AS value,
  hostname
FROM test_data
WHERE $__timeFilter("time_date_time")
GROUP BY time, hostname
ORDER BY time
```

This query produces a separate time series for each `hostname`. The alert rule evaluates the condition against each series independently, so you receive individual notifications per host.

### Alert on row count

To alert when the number of rows in a time window exceeds a threshold (for example, error count):

```sql
SELECT
  $__timeGroupAlias("created_at", '5m'),
  count(*) AS error_count
FROM error_logs
WHERE $__timeFilter("created_at")
  AND severity = 'ERROR'
GROUP BY time
ORDER BY time
```

## Template annotations and labels

You can use [template annotations and labels](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/templates/) to include query results or metadata in alert notifications and labels.

## Best practices

Follow these best practices when using PostgreSQL for alerting:

- **Keep queries fast:** Alert rules evaluate on a schedule (for example, every minute). Avoid expensive joins, subqueries, or scanning large unindexed tables. Add indexes on time columns and any columns used in `WHERE` clauses.
- **Use `$__timeFilter`:** Always include a `$__timeFilter` or `$__unixEpochFilter` macro to limit data to the evaluation window. Without it, the query scans the entire table on every evaluation.
- **Handle `NULL` values:** If your data contains `NULL` values, Grafana treats them as "no data." Configure the alert rule's **No data** behavior to match your expectations (for example, **Alerting**, **No data**, or **OK**).
- **Test in Explore first:** Verify your query returns the expected time series in [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) before using it in an alert rule. Check the **Format** is set to **Time series** and results are sorted by time.
- **Set realistic evaluation intervals:** Choose an evaluation interval that gives your query enough time to complete. If your query takes 10 seconds, don't evaluate every 10 seconds — allow for headroom.
