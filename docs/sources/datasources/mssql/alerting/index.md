---
aliases:
  - ../../data-sources/mssql/alerting/
description: Using Grafana Alerting with the Microsoft SQL Server data source
keywords:
  - grafana
  - MSSQL
  - Microsoft
  - SQL
  - alerting
  - alerts
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Alerting
title: Microsoft SQL Server alerting
weight: 450
---

# Microsoft SQL Server alerting

You can use Grafana Alerting with Microsoft SQL Server to create alerts based on your SQL Server data. This allows you to monitor metrics, detect anomalies, and receive notifications when specific conditions are met.

For general information about Grafana Alerting, refer to [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/).

## Before you begin

Before creating alerts with Microsoft SQL Server, ensure you have:

- A [configured Microsoft SQL Server data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/configure/)
- Appropriate permissions to create alert rules
- Understanding of the metrics you want to monitor

## Supported query types

Microsoft SQL Server alerting works with **time series queries** that return numeric data over time. Table-formatted queries are not supported in alert rule conditions.

To create a valid alert query:

- Include a `time` column that returns a SQL `datetime`/`datetime2` or a Unix epoch timestamp
- Return numeric values for the metrics you want to alert on
- Sort results by the time column

For more information on writing time series queries, refer to [Microsoft SQL Server query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mssql/query-editor/).

### Query format requirements

| Query format | Alerting support | Notes                                    |
| ------------ | ---------------- | ---------------------------------------- |
| Time series  | Yes              | Required for alerting                    |
| Table        | No               | Convert to time series format for alerts |

## Create an alert rule

To create an alert rule using Microsoft SQL Server:

1. Navigate to **Alerting** > **Alert rules**.
1. Click **New alert rule**.
1. Enter a name for the alert rule.
1. Select your **Microsoft SQL Server** data source.
1. Build your query using the query editor:
   - Set the **Format** to **Time series**
   - Include a time column using the `$__timeGroup()` or `$__timeGroupAlias()` macro
   - Add numeric columns for the values to monitor
   - Use `$__timeFilter()` to filter data by the evaluation time range
1. Configure the alert condition (for example, when the average is above a threshold).
1. Set the evaluation interval and pending period.
1. Configure notifications and labels.
1. Click **Save rule**.

For detailed instructions, refer to [Create a Grafana-managed alert rule](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/).

## Example alert queries

The following examples show common alerting scenarios with Microsoft SQL Server.

### Alert on high error count

Monitor the number of errors over time:

```sql
SELECT
  $__timeGroupAlias(created_at, '1m'),
  COUNT(*) AS error_count
FROM error_logs
WHERE $__timeFilter(created_at)
  AND level = 'error'
GROUP BY $__timeGroup(created_at, '1m')
ORDER BY 1
```

**Condition:** When `error_count` is above 100.

### Alert on average response time

Monitor API response times:

```sql
SELECT
  $__timeGroupAlias(request_time, '5m'),
  AVG(response_time_ms) AS avg_response_time
FROM api_requests
WHERE $__timeFilter(request_time)
GROUP BY $__timeGroup(request_time, '5m')
ORDER BY 1
```

**Condition:** When `avg_response_time` is above 500 (milliseconds).

### Alert on low order volume

Detect drops in order activity:

```sql
SELECT
  $__timeGroupAlias(order_date, '1h'),
  COUNT(*) AS order_count
FROM orders
WHERE $__timeFilter(order_date)
GROUP BY $__timeGroup(order_date, '1h')
ORDER BY 1
```

**Condition:** When `order_count` is below 10.

### Alert on high CPU utilization

Monitor server resource metrics:

```sql
SELECT
  $__timeGroupAlias(recorded_at, '5m'),
  AVG(cpu_percent) AS avg_cpu
FROM sys_metrics
WHERE $__timeFilter(recorded_at)
GROUP BY $__timeGroup(recorded_at, '5m')
ORDER BY 1
```

**Condition:** When `avg_cpu` is above 85.

## Limitations

When using Microsoft SQL Server with Grafana Alerting, be aware of the following limitations:

### Template variables not supported

Alert queries cannot contain template variables. Grafana evaluates alert rules on the backend without dashboard context, so variables like `$hostname` or `$environment` won't be resolved.

If your dashboard query uses template variables, create a separate query for alerting with hard-coded values.

### Table format not supported

Queries using the **Table** format cannot be used for alerting. Set the query format to **Time series** and ensure your query returns a time column.

### Query timeout

Complex queries with large datasets may timeout during alert evaluation. Optimize queries for alerting by:

- Adding appropriate `WHERE` clauses to limit data
- Using indexes on time and filter columns
- Reducing the time range evaluated

## Best practices

Follow these best practices when creating Microsoft SQL Server alerts:

- **Use time series format:** Always set the query format to Time series for alert queries.
- **Include time filters:** Use the `$__timeFilter()` macro to limit data to the evaluation window.
- **Use MSSQL macros:** Prefer `$__timeGroupAlias()` and `$__timeGroup()` over manual time-bucketing expressions.
- **Optimize queries:** Add indexes on columns used in `WHERE` clauses and `GROUP BY`.
- **Test queries first:** Verify your query returns expected results in Explore before creating an alert.
- **Set realistic thresholds:** Base alert thresholds on historical data patterns.
- **Use meaningful names:** Give alert rules descriptive names that indicate what they monitor.
