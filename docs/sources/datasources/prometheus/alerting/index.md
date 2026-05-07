---
description: Using Grafana Alerting with the Prometheus data source
keywords:
  - grafana
  - prometheus
  - alerting
  - alerts
  - promql
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Alerting
title: Prometheus alerting
weight: 550
review_date: 2026-05-07
---

# Prometheus alerting

You can use Grafana Alerting with Prometheus to create alerts based on your time-series data. This allows you to monitor metrics, detect anomalies, and receive notifications when specific conditions are met.

For general information about Grafana Alerting, refer to [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/).

## Before you begin

Before creating alerts with Prometheus, ensure you have:

- A Prometheus data source configured in Grafana
- Appropriate permissions to create alert rules
- Understanding of the PromQL metrics you want to monitor

## Alert rule types

Prometheus supports two alerting workflows in Grafana:

| Type | Description |
| ---- | ----------- |
| **Grafana-managed alert rules** | Alert rules defined and evaluated within Grafana, using Prometheus as the query data source. You create and manage these entirely in the Grafana Alerting UI. |
| **Data source-managed rules** | Alerting rules defined in Prometheus itself (in `prometheus.yml` or rule files). When **Manage alerts via Alerting UI** is enabled in the data source configuration, Grafana displays these existing rules in the Alerting UI. For Prometheus (unlike Mimir), this is read-only. |

## Create a Grafana-managed alert rule

To create a Grafana-managed alert rule using Prometheus:

1. Navigate to **Alerting** > **Alert rules**.
1. Click **New alert rule**.
1. Enter a name for the alert rule.
1. Select your **Prometheus** data source.
1. Write a PromQL query in the query editor.
1. Configure the alert condition (for example, when the last value is above a threshold).
1. Set the evaluation interval and pending period.
1. Configure notifications and labels.
1. Click **Save rule**.

For detailed instructions, refer to [Create a Grafana-managed alert rule](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/).

## View data source-managed rules

When **Manage alerts via Alerting UI** is enabled in the Prometheus data source configuration, Grafana fetches and displays alerting rules defined in Prometheus. These appear in the Alerting UI alongside Grafana-managed rules but are marked as data source-managed.

For Prometheus data sources, this view is read-only. To modify these rules, update your Prometheus rule files directly.

{{< admonition type="note" >}}
For Mimir and Cortex data sources, the Alerting UI supports both viewing and creating data source-managed rules. Prometheus only supports viewing.
{{< /admonition >}}

## Example alert queries

The following examples show common alerting scenarios with Prometheus.

### Alert on high CPU usage

Monitor CPU usage and alert when it exceeds a threshold:

```promql
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 90
```

Set the condition to alert when the last value is above 0 (the query already encodes the threshold).

Alternatively, use a simpler query and set the threshold in the alert condition:

```promql
avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100
```

Set the condition to alert when the last value is below 10 (meaning less than 10% idle, or more than 90% busy).

### Alert on high memory usage

Monitor memory usage across nodes:

```promql
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100
```

Set the condition to alert when the last value exceeds 85.

### Alert on high error rate

Monitor HTTP error rates:

```promql
sum(rate(http_requests_total{status=~"5.."}[5m])) by (job)
  /
sum(rate(http_requests_total[5m])) by (job)
  * 100
```

Set the condition to alert when the error percentage exceeds 5.

### Alert on target down

Monitor whether Prometheus scrape targets are reachable:

```promql
up{job="myservice"} == 0
```

Set the condition to alert when the last value equals 0.

## Recording rules as alert targets

Prometheus supports [Grafana-managed recording rules](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/) that pre-compute expensive queries. If **Allow as recording rules target** is enabled in the data source configuration, Grafana can write recording rule results back to this Prometheus instance.

This is useful for pre-aggregating complex expressions that you then use in alert rules, improving evaluation performance.

## Limitations

When using Prometheus with Grafana Alerting, be aware of the following limitations.

### Template variables not supported

Alert queries don't support template variables. Grafana evaluates alert rules on the backend without dashboard context, so variables like `$instance` or `$job` aren't resolved.

If your dashboard query uses template variables, create a separate query for alerting with hard-coded values or use label matchers directly.

### Query complexity

Complex queries with many nested functions or large result sets may timeout or fail to evaluate. Simplify queries for alerting by:

- Reducing the time range used in range vectors
- Using appropriate aggregation to limit the number of returned series
- Adding label filters to narrow the data scanned
- Using recording rules to pre-compute expensive expressions

### Data source-managed rules are read-only

Grafana can display Prometheus alerting rules but can't create or modify them through the UI. To manage Prometheus-native alerting rules, edit your Prometheus rule files directly and reload the configuration.

## Best practices

Follow these best practices when creating Prometheus alerts:

- **Use `$__rate_interval`:** When using `rate()` or `increase()` in alert queries, use the `$__rate_interval` variable to avoid gaps caused by scrape interval mismatches.
- **Add label filters:** Include specific label matchers to focus on relevant data and improve query performance.
- **Set realistic pending periods:** Use the pending period to avoid alerting on brief spikes. For example, set a 5-minute pending period so the condition must persist before firing.
- **Test queries first:** Verify your query returns expected results in Explore before creating an alert.
- **Use meaningful names:** Give alert rules descriptive names that indicate what they monitor and the severity.
- **Pre-aggregate with recording rules:** For complex or frequently evaluated expressions, create recording rules and alert on the pre-aggregated metric.

If you encounter errors when creating or evaluating alert rules, refer to [Troubleshoot Prometheus data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/troubleshooting/#alerting-errors).
