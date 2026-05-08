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

## Evaluation groups and intervals

Alert rules are organized into evaluation groups. Each group has an evaluation interval that determines how frequently the rules in that group are evaluated. For example, an evaluation interval of `1m` means the alert query runs every 60 seconds.

The **pending period** determines how long a condition must be continuously true before the alert fires. For example, with a 1-minute evaluation interval and a 5-minute pending period, the condition must be true for 5 consecutive evaluations before firing.

Choose evaluation intervals based on your use case:

- **15s–30s** — Critical infrastructure alerts where fast detection matters.
- **1m** — Standard monitoring alerts (recommended default).
- **5m** — Non-urgent or noisy metrics where you want to reduce evaluation load.

## Example alert queries

The following examples show common alerting scenarios with Prometheus. Each example shows the PromQL query and how to configure the alert condition.

### Alert on high CPU usage

Monitor CPU usage and alert when it exceeds 90%:

**Query A:**

```promql
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[$__rate_interval])) * 100)
```

**Condition:** Set the threshold to alert when the last value of **A** is above `90`.

This approach separates the metric query from the threshold, making it easier to adjust the threshold later without editing the PromQL.

### Alert on high memory usage

Monitor memory usage across nodes:

**Query A:**

```promql
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100
```

**Condition:** Alert when the last value of **A** exceeds `85`.

### Alert on high error rate

Monitor HTTP error rates per service:

**Query A:**

```promql
sum(rate(http_requests_total{status=~"5.."}[$__rate_interval])) by (job)
  /
sum(rate(http_requests_total[$__rate_interval])) by (job)
  * 100
```

**Condition:** Alert when the last value of **A** exceeds `5` (meaning error rate above 5%).

### Alert on target down

Monitor whether Prometheus scrape targets are reachable:

**Query A:**

```promql
up{job="myservice"}
```

**Condition:** Alert when the last value of **A** is below `1`.

### Alert when a metric disappears

Use `absent()` to detect when a metric stops being scraped entirely — for example, when a service crashes and no longer reports metrics:

**Query A:**

```promql
absent(up{job="myservice"})
```

**Condition:** Alert when the last value of **A** equals `1` (the `absent()` function returns 1 when the metric is missing, and nothing when the metric exists).

For detecting staleness over a time window (metric exists but hasn't reported recently):

```promql
absent_over_time(up{job="myservice"}[5m])
```

### Multi-condition alert (high latency AND high traffic)

Use multiple queries and expressions to alert only when multiple conditions are true simultaneously. This reduces noise by avoiding alerts during low-traffic periods.

**Query A** — P95 latency:

```promql
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="api"}[$__rate_interval])) by (le))
```

**Query B** — Request rate:

```promql
sum(rate(http_requests_total{job="api"}[$__rate_interval]))
```

**Expression C** — Math (both conditions must be true):

```
$A > 2 && $B > 100
```

**Condition:** Alert when **C** has a value (it only returns data when both latency exceeds 2 seconds AND request rate exceeds 100 req/s).

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

### OAuth token handling differs between Explore and Alerting

When using OAuth-authenticated Prometheus endpoints (Google Managed Prometheus, Azure Managed Prometheus), queries may succeed in Explore and dashboards but fail intermittently during alert evaluation. This happens because the alerting backend handles token refresh differently from the interactive query path.

If you're using GCP, consider the **datasource-syncer** pattern — a sidecar process that refreshes OAuth tokens and updates the data source credentials on a schedule shorter than the token lifetime.

For detailed troubleshooting steps, refer to [OAuth token expiration errors](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/troubleshooting/#oauth-token-expiration-errors-gcp-and-azure).

### Data source-managed rules are read-only

Grafana can display Prometheus alerting rules but can't create or modify them through the UI. To manage Prometheus-native alerting rules, edit your Prometheus rule files directly and reload the configuration.

## Configure alert state for execution errors

By default, when a Grafana-managed alert rule encounters an execution error or timeout (such as a network blip, i/o timeout, or a transient 502 from Prometheus), the rule enters an **Error** state — which fires the alert. This can cause false alarms and spam on-call teams when the underlying issue is a brief connectivity interruption rather than a genuine threshold breach.

To prevent false positives from transient errors, configure the **Alert state if execution error or timeout** setting on each alert rule:

1. Open the alert rule for editing.
1. In the alert conditions section, locate **Alert state if execution error or timeout**.
1. Change the value from **Alerting** (default) to one of:
   - **Keep Last State** — The alert retains its previous state (firing or normal) until a successful evaluation occurs. This is the recommended setting for most Prometheus alert rules.
   - **OK** — The alert is set to normal during the error, preventing it from firing.
1. Click **Save rule**.

{{< admonition type="note" >}}
If your alert rules frequently enter an error state, investigate the root cause (network stability, Prometheus resource limits, query timeout settings) rather than relying solely on this setting to suppress notifications.
{{< /admonition >}}

Common transient errors that trigger this behavior include:

- `sse.dependencyError` or `sse.dataQueryError` in alert state history
- "context deadline exceeded" or "i/o timeout" messages
- HTTP 502 or 500 responses from the Prometheus server

For more details on troubleshooting these errors, refer to [Troubleshoot Prometheus data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/troubleshooting/#transient-alert-errors-triggering-false-alarms).

## Best practices

Follow these best practices when creating Prometheus alerts:

- **Configure error state handling:** Set **Alert state if execution error or timeout** to **Keep Last State** to prevent transient backend errors from triggering false alarms.
- **Use `$__rate_interval`:** When using `rate()` or `increase()` in alert queries, use `$__rate_interval` to ensure the range window is always large enough relative to the scrape interval. Grafana resolves this variable based on the evaluation interval and scrape interval configuration.
- **Add label filters:** Include specific label matchers to focus on relevant data and improve query performance.
- **Set realistic pending periods:** Use the pending period to avoid alerting on brief spikes. For example, set a 5-minute pending period so the condition must persist before firing.
- **Test queries first:** Verify your query returns expected results in Explore before creating an alert.
- **Use meaningful names:** Give alert rules descriptive names that indicate what they monitor and the severity.
- **Pre-aggregate with recording rules:** For complex or frequently evaluated expressions, create recording rules and alert on the pre-aggregated metric.

If you encounter errors when creating or evaluating alert rules, refer to [Troubleshoot Prometheus data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/troubleshooting/#alerting-errors).
