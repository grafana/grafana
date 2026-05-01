---
description: Using Grafana Alerting with the InfluxDB data source
keywords:
  - grafana
  - influxdb
  - alerting
  - alerts
  - influxql
  - flux
  - sql
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Alerting
title: InfluxDB alerting
weight: 550
review_date: 2026-05-01
---

# InfluxDB alerting

You can use Grafana Alerting with InfluxDB to create alerts based on your time-series data. This allows you to monitor metrics, detect anomalies, and receive notifications when specific conditions are met.

For general information about Grafana Alerting, refer to [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/).

## Before you begin

Before creating alerts with InfluxDB, ensure you have:

- An InfluxDB data source configured in Grafana
- Appropriate permissions to create alert rules
- Understanding of the metrics you want to monitor

## Supported query types

InfluxDB alerting supports all three query languages: InfluxQL, SQL, and Flux. Queries must return time-series data for Grafana to evaluate values over time and trigger alerts when thresholds are crossed.

### Query language compatibility

| Query language | Alerting support | Notes |
| -------------- | ---------------- | ----- |
| InfluxQL       | Yes              | Use aggregation functions with GROUP BY time. |
| Flux           | Yes              | Use `aggregateWindow()` for time-based aggregation. |
| SQL            | Yes              | Use `$__timeFilter` and `$__dateBin` macros for time filtering. |

## Create an alert rule

To create an alert rule using InfluxDB:

1. Navigate to **Alerting** > **Alert rules**.
1. Click **New alert rule**.
1. Enter a name for the alert rule.
1. Select your **InfluxDB** data source.
1. Build your query using the query editor.
1. Configure the alert condition (for example, when the average is above a threshold).
1. Set the evaluation interval and pending period.
1. Configure notifications and labels.
1. Click **Save rule**.

For detailed instructions, refer to [Create a Grafana-managed alert rule](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/).

## Example alert queries

The following examples show common alerting scenarios with InfluxDB.

### InfluxQL: Alert on high CPU usage

Monitor CPU usage and alert when it exceeds a threshold:

1. **Query:** Select the `cpu` measurement with `mean("usage_system")` as the aggregation.
1. **GROUP BY:** `time($__interval)`
1. **Condition:** When mean is above 90.

In raw query mode:

```sql
SELECT mean("usage_system") FROM "cpu" WHERE $timeFilter GROUP BY time($__interval) fill(null)
```

### Flux: Alert on memory pressure

Monitor memory usage with a Flux query:

```flux
from(bucket: "telegraf")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "mem")
  |> filter(fn: (r) => r["_field"] == "used_percent")
  |> aggregateWindow(every: v.windowPeriod, fn: mean)
  |> yield(name: "mean")
```

Set the condition to alert when the mean value exceeds 85.

### SQL: Alert on disk usage

Monitor disk usage with a SQL query:

```sql
SELECT $__dateBin(time), mean(used_percent)
FROM disk
WHERE $__timeFilter(time)
GROUP BY $__dateBin(time)
```

Set the condition to alert when the mean value exceeds 80.

## Limitations

When using InfluxDB with Grafana Alerting, be aware of the following limitations:

### Template variables not supported

Alert queries can't contain template variables. Grafana evaluates alert rules on the backend without dashboard context, so variables like `$hostname` or `$region` aren't resolved.

If your dashboard query uses template variables, create a separate query for alerting with hard-coded values.

### Query complexity

Complex queries with many nested functions or large result sets may timeout or fail to evaluate. Simplify queries for alerting by:

- Reducing the time range
- Using appropriate aggregation intervals
- Adding filters to limit the data scanned

## Best practices

Follow these best practices when creating InfluxDB alerts:

- **Use specific filters:** Add WHERE clauses or Flux filters to focus on relevant data and improve query performance.
- **Choose appropriate intervals:** Match the GROUP BY time interval to your evaluation frequency.
- **Test queries first:** Verify your query returns expected results in Explore before creating an alert.
- **Set realistic thresholds:** Base alert thresholds on historical data patterns.
- **Use meaningful names:** Give alert rules descriptive names that indicate what they monitor.
