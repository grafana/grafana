---
description: Using annotations with the Prometheus data source in Grafana
keywords:
  - grafana
  - prometheus
  - annotations
  - events
  - promql
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Annotations
title: Prometheus annotations
weight: 500
review_date: 2026-05-07
---

# Prometheus annotations

Annotations overlay event data on your dashboard graphs, helping you correlate events with metrics. You can use Prometheus as a data source for annotations to display events such as deployments, alerts, or threshold crossings on your visualizations.

For general information about annotations, refer to [Annotate visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/).

## Before you begin

Before creating Prometheus annotations, ensure you have:

- A configured Prometheus data source in Grafana
- Metrics in Prometheus that represent the events you want to annotate
- Read access to the Prometheus instance

## Create an annotation query

To add a Prometheus annotation to your dashboard:

1. Navigate to your dashboard and click **Dashboard settings** (gear icon).
1. Select **Annotations** in the left menu.
1. Click **Add annotation query**.
1. Enter a **Name** for the annotation.
1. Select your **Prometheus** data source from the **Data source** drop-down.
1. Enter a PromQL expression in the query field.
1. Set the **Min step** to control annotation density (a larger step means fewer annotations).
1. Configure the field mappings to control what appears in the annotation tooltip.
1. Optionally, select a **Color** for the annotation markers to distinguish different annotation types visually.
1. Click **Save dashboard**.

## How Prometheus annotations work

Prometheus annotations work differently from SQL-based annotations. Instead of querying a table of events, you write a PromQL expression that returns time-series data. Grafana converts the query results into annotation events using these rules:

- Grafana executes the PromQL query as a range query over the dashboard's time window.
- **Every data point returned creates an annotation.** There is no automatic filtering of zero values — if you only want annotations at specific moments, your PromQL expression must filter the results (for example, using `> 0` or the `ALERTS` metric).
- Grafana uses the field mapping configuration to determine what text, title, and tags to display for each annotation.
- If the query returns multiple time series, each series produces its own set of annotations.

{{< admonition type="note" >}}
Because every returned data point creates an annotation, queries that return continuous data (like `node_cpu_seconds_total`) will produce an annotation at every step interval, flooding your dashboard. Always use expressions that return data only at the moments you want annotated.
{{< /admonition >}}

## Field mappings

After entering your PromQL expression, use the field mapping drop-downs to control how query results are displayed as annotations. Grafana shows mapping options for:

| Field       | Description                                                                                          | Default behavior                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Time**    | The timestamp for the annotation.                                                                    | Uses the first time-type field (always present).                                  |
| **TimeEnd** | An end timestamp for range annotations, which display as a shaded region instead of a vertical line. | Not set (produces point annotations).                                             |
| **Title**   | Short label displayed on the annotation marker.                                                      | Not set.                                                                          |
| **Text**    | The annotation description displayed when you hover over it.                                         | Uses the first string-type field, or the metric/label display name if configured. |
| **Tags**    | Comma-separated tags for the annotation. Helps categorize and filter annotations.                    | Not set.                                                                          |

To configure field mappings, select the appropriate field name from each drop-down, or enter a fixed text value.

## Example annotation queries

The following examples show common annotation patterns with Prometheus.

### Alert-based annotations using `ALERTS`

The most common and reliable way to create Prometheus annotations. Prometheus automatically generates an `ALERTS` metric for all configured alerting rules.

```promql
ALERTS{alertstate="firing"}
```

This creates an annotation at every step interval where an alert is firing. The `ALERTS` metric includes labels such as:

- `alertname` — The name of the alerting rule
- `alertstate` — Either `firing` or `pending`
- Any labels defined on the alerting rule

To limit to specific alerts or severity levels:

```promql
ALERTS{alertname="HighCPUUsage", severity="critical"}
```

Configure the field mappings:

- **Text:** `alertname` (displays the alert name on hover)
- **Tags:** `severity` (allows filtering by severity)

### Service restart annotations

Display annotations when a process restarts. The `changes()` function detects when a value changes, and `> 0` ensures annotations only appear at the moment of change:

```promql
changes(process_start_time_seconds{job="myservice"}[5m]) > 0
```

### Deployment annotations

If you track deployments by pushing a timestamp metric via `Pushgateway` or a recording rule:

```promql
changes(deployment_timestamp_seconds{environment="production"}[10m]) > 0
```

Configure the field mappings:

- **Text:** `environment` (shows which environment was deployed)
- **Tags:** `environment`

### Threshold crossing annotations

Display annotations when available memory drops below 10%:

```promql
node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes < 0.1
```

{{< admonition type="note" >}}
Comparison operators in PromQL act as filters — they only return data points where the condition is true. This means the expression above only returns data when memory is below 10%, and annotations only appear at those times. There's no need to add an outer `> 0` wrapper.
{{< /admonition >}}

### Scaling event annotations

Display annotations when the number of running pods changes:

```promql
changes(kube_deployment_status_replicas{deployment="my-app"}[5m]) > 0
```

### Error spike annotations

Display annotations when the error rate exceeds a threshold:

```promql
sum(rate(http_requests_total{status=~"5.."}[5m])) by (job) / sum(rate(http_requests_total[5m])) by (job) > 0.05
```

This creates annotations when the error rate exceeds 5%.

### Version or build change annotations

If you expose build metadata using a metric like `build_info` (common in Go services), annotate when the version changes:

```promql
changes(build_info{job="myservice"}[10m]) > 0
```

Configure the field mappings:

- **Text:** `version` (shows the new version in the annotation tooltip)
- **Tags:** `job`

If your build info metric uses a `version` label (for example, `build_info{version="1.2.3"}`), the annotation tooltip displays the version that was deployed.

## Control annotation density

The **Min step** setting controls how many data points the query returns, which directly affects how many annotations appear. A larger step means fewer annotations:

- **Min step `1m`** — Up to one annotation per minute (good for short time ranges).
- **Min step `5m`** — Up to one annotation per 5 minutes (good for day-range dashboards).
- **Min step `1h`** — Up to one annotation per hour (good for week-range dashboards).

If your dashboard shows too many annotation markers, increase the Min step or add more specific filters to your query.

## Use template variables in annotations

You can use template variables in your annotation queries to filter annotations based on dashboard variable selections:

```promql
ALERTS{alertstate="firing", instance=~"$instance"}
```

```promql
changes(process_start_time_seconds{job="$job"}[5m]) > 0
```

Template variables in annotations are resolved at query time using the current dashboard variable values.

## Range annotations

Range annotations display as shaded regions rather than vertical lines, representing events with duration. To create range annotations, the query result must include a **TimeEnd** field mapping.

Because PromQL doesn't natively return start/end time pairs, range annotations with Prometheus are limited to scenarios where you have separate metrics for start and end times (for example, via recording rules or custom metrics pushed to `Pushgateway`). For most use cases, point annotations (using the examples in this page) are the practical approach.

If your annotations aren't appearing or you encounter errors, refer to [Troubleshoot Prometheus data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/troubleshooting/#annotation-errors).
