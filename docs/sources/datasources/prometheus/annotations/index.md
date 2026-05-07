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
1. Configure the field mappings if needed.
1. Click **Save dashboard**.

## Annotation query behavior

Prometheus annotations work differently from SQL-based annotations. Instead of querying a table of events, you write a PromQL expression that returns time-series data. Grafana converts the results into annotation events based on the following rules:

- Each data point where the value is non-zero (or changes from zero to non-zero) creates an annotation.
- The metric name and labels are used as the annotation text and tags by default.
- You can customize the field mappings to control what appears in the annotation tooltip.

## Field mappings

Field mappings control how Prometheus query results are displayed as annotations.

| Field       | Description                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| **Title**   | The metric name or label value to use as the annotation title.                                                |
| **Text**    | The label or value to display as the annotation description when you hover over it.                           |
| **Tags**    | Labels to use as annotation tags. Tags help categorize and filter annotations.                                |
| **TimeEnd** | A second timestamp field for range annotations, which display as a shaded region instead of a vertical line.  |

## Example annotation queries

The following examples show common annotation patterns with Prometheus.

### Alert-based annotations

Display annotations when a metric exceeds a threshold:

```promql
ALERTS{alertname="HighCPUUsage", alertstate="firing"}
```

This query creates an annotation for each firing alert instance.

### Deployment annotations

If you push deployment events to Prometheus using a push gateway or recording rule, you can annotate them:

```promql
changes(deployment_timestamp_seconds[5m]) > 0
```

This creates an annotation each time the deployment timestamp changes.

### Threshold crossing annotations

Display annotations when a metric crosses a specific value:

```promql
node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes < 0.1
```

This creates annotations when available memory drops below 10%.

### Service restart annotations

Display annotations when a process restarts:

```promql
changes(process_start_time_seconds{job="myservice"}[5m]) > 0
```

## Use the `ALERTS` metric

Prometheus automatically generates an `ALERTS` metric for all configured alerting rules. This is one of the most common ways to create annotations because it directly links your alerting rules to visual markers on your dashboards.

The `ALERTS` metric includes labels such as:

- `alertname` - The name of the alerting rule
- `alertstate` - Either `firing` or `pending`
- Any labels defined on the alerting rule

Example using label filters:

```promql
ALERTS{alertstate="firing", severity="critical"}
```

## Use template variables in annotations

You can use template variables in your annotation queries to filter annotations based on dashboard variable selections:

```promql
ALERTS{alertname="HighCPUUsage", instance=~"$instance"}
```

{{< admonition type="note" >}}
Template variables in annotations are resolved at query time using the current dashboard variable values.
{{< /admonition >}}

## Range annotations

To create range annotations that display as shaded regions rather than vertical lines, your query needs to return data with both a start and end time. This works best with metrics that represent events with duration, such as maintenance windows tracked via recording rules.

If your annotations aren't appearing or you encounter errors, refer to [Troubleshoot Prometheus data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/troubleshooting/#annotation-errors).
