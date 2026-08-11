---
aliases:
  - ../../data-sources/graphite/alerting/
description: Use Grafana Alerting with the Graphite data source
keywords:
  - grafana
  - graphite
  - alerting
  - alerts
  - notifications
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Alerting
title: Graphite alerting
weight: 375
review_date: 2026-08-11
---

# Graphite alerting

You can use Grafana Alerting with Graphite to create alerts based on your time series data. This lets you monitor metrics, detect anomalies, and receive notifications when specific conditions are met.

For general information about Grafana Alerting, refer to [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/).

## Before you begin

Before creating alerts with Graphite, ensure you have:

- A Graphite data source configured in Grafana. Refer to [Configure the Graphite data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/graphite/configure/).
- Permission to create alert rules.
- An understanding of the metrics you want to monitor.

## Supported queries

Grafana Alerting evaluates any Graphite query that returns time series data. Grafana runs the query on the backend, reduces each series to a single value, and compares that value against the condition you define.

| Query pattern                  | Alerting support | Notes                                                                        |
| ------------------------------ | ---------------- | ---------------------------------------------------------------------------- |
| Single metric path             | Yes              | The most predictable option for alerting.                                    |
| Aggregated series              | Yes              | Use `sumSeries()`, `averageSeries()`, or similar to combine matching series. |
| Wildcard metric path           | Yes              | Returns one series per match. Reduce or aggregate before the condition.      |
| Tag query with `seriesByTag()` | Yes              | Requires Graphite 1.1 or later.                                              |

## Create an alert rule

To create an alert rule using Graphite:

1. Navigate to **Alerting** > **Alert rules**.
1. Click **New alert rule**.
1. Enter a name for the alert rule.
1. In the query section, select your **Graphite** data source.
1. Build your query:
   - Click **Select metric** to choose the metric path, or click the pencil icon to write the query in code.
   - Add Graphite functions to aggregate or shape the series, for example `sumSeries()` or `summarize()`.
1. Add a **Reduce** expression to convert the series to a single value, for example `Last` or `Mean`.
1. Add a **Threshold** expression that defines when the alert fires, for example when the value is above a limit.
1. Set the evaluation interval and pending period.
1. Configure notifications and labels.
1. Click **Save rule**.

For detailed instructions, refer to [Create a Grafana-managed alert rule](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/).

## Example alert queries

The following examples show common alerting scenarios with Graphite. Each query returns a single series that the alert condition reduces to one value.

### Alert on high CPU usage

Monitor CPU usage on a host and alert when it exceeds 90%:

```text
averageSeries(servers.web01.cpu.percent.user)
```

**Condition:** Reduce with `Mean`, then alert when the value is above `90`.

### Alert on low free disk space

Monitor available disk space and alert when it drops below 10 GB:

```text
servers.web01.disk.root.free_bytes
```

**Condition:** Reduce with `Last`, then alert when the value is below `10737418240`.

### Alert on high error rate

Combine error counts across a service and alert on spikes:

```text
summarize(sumSeries(stats.myservice.errors.count), '5min', 'sum', false)
```

**Condition:** Reduce with `Last`, then alert when the value is above `100`.

### Alert on request latency

Monitor 95th percentile latency and alert when it exceeds 500 ms:

```text
stats.timers.myservice.request.latency.p95
```

**Condition:** Reduce with `Mean`, then alert when the value is above `500`.

### Alert across many hosts

Use a wildcard to evaluate every matching host and alert when any host crosses the threshold:

```text
aliasByNode(servers.*.cpu.percent.user, 1)
```

Because the wildcard returns one series per host, configure the alert rule to evaluate each series separately so you get a distinct alert instance for each host that breaches the threshold.

## Limitations

When using Graphite with Grafana Alerting, be aware of the following limitations.

### Template variables not supported

Alert queries can't contain template variables. Grafana evaluates alert rules on the backend without dashboard context, so variables like `$server` or `$environment` aren't resolved.

If your dashboard query uses template variables, create a separate query for alerting with hard-coded values.

### Nested queries not supported

Alert queries can't reference another query by letter, such as `#A`. Build a self-contained query for each alert rule instead of chaining query references.

### Consolidation affects results

Grafana consolidates data points so that a query doesn't return more points than needed. Consolidation can change the value the alert evaluates. Use `consolidateBy()` or `summarize()` to control how Graphite aggregates points, and match the interval to your evaluation frequency.

## Best practices

Follow these best practices when creating Graphite alerts:

- **Return a single series:** Aggregate wildcard queries with `sumSeries()` or `averageSeries()`, or evaluate each series separately when you want per-target alerts.
- **Control consolidation:** Use `consolidateBy()` or `summarize()` so the evaluated value matches what you expect.
- **Test queries first:** Verify your query returns the expected values in [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) before creating an alert.
- **Set realistic thresholds:** Base thresholds on historical data patterns to avoid false positives.
- **Use meaningful names:** Give alert rules descriptive names that indicate what they monitor.

## Next steps

- [Build queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/graphite/query-editor/) to explore your metrics before creating alerts.
- [Troubleshoot Graphite data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/graphite/troubleshooting/) if alerts aren't firing as expected.
