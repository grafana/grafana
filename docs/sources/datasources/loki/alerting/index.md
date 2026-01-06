---
aliases:
  - ../../data-sources/loki/alerting/
description: Use Grafana Alerting with the Loki data source
keywords:
  - grafana
  - loki
  - alerting
  - alerts
  - logs
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Alerting
title: Loki alerting
weight: 450
refs:
  alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/
  create-alert-rule:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-grafana-managed-rule/
  configure-loki:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure/
---

# Loki alerting

You can use Grafana Alerting with Loki to create alerts based on your log data. This allows you to monitor error rates, detect patterns, and receive notifications when specific conditions are met in your logs.

For general information about Grafana Alerting, refer to [Grafana Alerting](ref:alerting).

## Before you begin

Before creating alerts with Loki, ensure you have:

- A [Loki data source configured](ref:configure-loki) in Grafana.
- Appropriate permissions to create alert rules.
- Understanding of the log patterns you want to monitor.
- The **Manage alert rules in Alerting UI** toggle enabled in the Loki data source settings.

## Supported query types

Loki alerting requires **metric queries** that return numeric time series data. You must use LogQL metric queries that wrap log stream selectors with aggregation functions.

### Query types and alerting compatibility

| Query type    | Alerting support | Notes                                            |
| ------------- | ---------------- | ------------------------------------------------ |
| Metric query  | ✅ Full support  | Use range aggregation functions like `rate()`    |
| Log query     | ❌ Not supported | Convert to metric query using aggregations       |
| Instant query | ⚠️ Limited       | Range queries recommended for time-based alerts  |

### Common metric functions for alerting

Use these LogQL functions to convert log queries into metric queries suitable for alerting:

| Function            | Description                                      | Example                                              |
| ------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| `rate()`            | Rate of log entries per second                   | `rate({job="app"}[5m])`                              |
| `count_over_time()` | Count of log entries in the specified interval   | `count_over_time({job="app"}[5m])`                   |
| `sum_over_time()`   | Sum of extracted numeric values                  | `sum_over_time({job="app"} \| unwrap latency [5m])`  |
| `avg_over_time()`   | Average of extracted numeric values              | `avg_over_time({job="app"} \| unwrap latency [5m])` |
| `max_over_time()`   | Maximum extracted value in the interval          | `max_over_time({job="app"} \| unwrap latency [5m])` |
| `bytes_rate()`      | Rate of bytes per second                         | `bytes_rate({job="app"}[5m])`                        |
| `absent_over_time()`| Returns 1 if no logs exist in the interval       | `absent_over_time({job="app"}[5m])`                  |

## Create an alert rule

To create an alert rule using Loki:

1. Navigate to **Alerting** > **Alert rules**.
1. Click **New alert rule**.
1. Enter a name for the alert rule.
1. Select your **Loki** data source.
1. Build your metric query:
   - Start with a log stream selector (for example, `{job="app"}`)
   - Add filters if needed (for example, `|= "error"`)
   - Wrap with a metric function (for example, `rate(...[5m])`)
1. Configure the alert condition (for example, when the rate is above a threshold).
1. Set the evaluation interval and pending period.
1. Configure notifications and labels.
1. Click **Save rule**.

For detailed instructions, refer to [Create a Grafana-managed alert rule](ref:create-alert-rule).

## Example alert queries

The following examples show common alerting scenarios with Loki.

### Alert on high error rate

Monitor the rate of error logs:

```logql
rate({job="app"} |= "error" [5m]) > 0.1
```

This query calculates the rate of log lines containing "error" per second over the last 5 minutes and alerts when it exceeds 0.1 errors per second.

### Alert on error count threshold

Monitor the count of errors in a time window:

```logql
sum(count_over_time({job="app", level="error"}[15m])) > 100
```

This query counts error-level logs over 15 minutes and alerts when the count exceeds 100.

### Alert on high latency

Monitor request latency extracted from logs:

```logql
avg_over_time({job="api"} | logfmt | unwrap duration [5m]) > 500
```

This query extracts the `duration` field from logfmt-formatted logs and alerts when the average exceeds 500 milliseconds.

### Alert on missing logs

Detect when a service stops sending logs:

```logql
absent_over_time({job="critical-service"}[10m])
```

This query alerts when no logs are received from the critical service for 10 minutes.

### Alert by label grouping

Monitor errors grouped by service:

```logql
sum by (service) (rate({namespace="production"} |= "error" [5m])) > 0.05
```

This query calculates error rates per service and alerts when any service exceeds the threshold.

## Limitations

When using Loki with Grafana Alerting, be aware of the following limitations:

### Template variables not supported

Alert queries cannot contain template variables. Grafana evaluates alert rules on the backend without dashboard context, so variables like `$job` or `$namespace` are not resolved.

If your dashboard query uses template variables, create a separate query for alerting with hard-coded values.

### Log queries not supported

Queries that return log lines cannot be used for alerting. You must convert log queries to metric queries using aggregation functions like `rate()` or `count_over_time()`.

### Query time range

Alert queries use the evaluation interval to determine the time range, not the dashboard time picker. Ensure your metric function intervals (for example, `[5m]`) align with your alert evaluation frequency.

## Best practices

Follow these best practices when creating Loki alerts:

- **Use metric queries:** Always wrap log stream selectors with metric functions for alerting.
- **Match intervals:** Align the LogQL time interval (for example, `[5m]`) with your alert evaluation interval.
- **Be specific with selectors:** Use precise label selectors to reduce the amount of data scanned.
- **Test queries first:** Verify your query returns expected numeric results in Explore before creating an alert.
- **Use meaningful thresholds:** Base alert thresholds on historical patterns in your log data.
- **Add context with labels:** Include relevant labels in your alert to help with triage.

