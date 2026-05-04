---
aliases:
  - ../../data-sources/prometheus/annotations/
description: Using annotations with Prometheus in Grafana
keywords:
  - grafana
  - prometheus
  - annotations
  - events
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Annotations
title: Prometheus annotations
weight: 500
review_date: 2026-03-10
---

# Prometheus annotations

Annotations overlay event markers on your dashboard visualizations, helping you correlate metric behavior with events like alerts firing, deployments, or configuration changes. You can use the Prometheus data source to create annotation queries that display PromQL query results as annotation events.

For general information about annotations, refer to [Annotate visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/).

## Before you begin

Before you create Prometheus annotations, ensure you have:

- A [configured Prometheus data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/configure/)
- Familiarity with [PromQL](https://prometheus.io/docs/prometheus/latest/querying/basics/) query syntax
- Metrics in Prometheus that represent events you want to annotate (for example, `ALERTS`, deployment timestamps)

## Create an annotation query

To add a Prometheus annotation to your dashboard:

1. Navigate to your dashboard and click **Dashboard settings** (gear icon).
1. Select **Annotations** in the left menu.
1. Click **Add annotation query**.
1. Enter a **Name** for the annotation.
1. Select your **Prometheus** data source from the **Data source** drop-down.
1. Configure the annotation query options.
1. Click **Save dashboard**.

## Annotation query options

The Prometheus annotation query editor provides the following configuration fields.

| Field                         | Description                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **PromQL expression**         | The PromQL query that returns time series data. Each non-zero data point creates an annotation event.                                                                                                        |
| **Min step**                  | An additional lower limit for the step parameter of the query and for the `$__interval` and `$__rate_interval` variables. Leave empty for automatic step calculation.                                        |
| **Title**                     | A template for the annotation title. Use `{{label_name}}` syntax to interpolate label values. For example, `{{alertname}}` inserts the value of the `alertname` label.                                       |
| **Tags**                      | Comma-separated list of label names whose values become annotation tags. Tags help categorize and filter annotations. For example, `severity,instance`.                                                      |
| **Text**                      | A template for the annotation description text. Uses the same `{{label_name}}` interpolation syntax as the Title field. For example, `{{instance}}`.                                                         |
| **Series value as timestamp** | When enabled, the series value is used as the annotation timestamp instead of the time field. The unit of timestamp is milliseconds. If the series value is in seconds, multiply the range vector by `1000`. |

## Understand event groups

Prometheus annotations automatically group consecutive non-zero data points into region annotations when they're within one step interval of each other. Instead of creating a separate annotation marker for each data point, Grafana combines nearby events into a single shaded region on the graph. This is useful for representing events that span a duration, such as an alert that fires for several minutes.

## Example: Alert firing annotations

To display Prometheus alert events as annotations, use the built-in `ALERTS` metric:

1. Create an annotation query with the following settings:
   - **PromQL expression:** `ALERTS{alertstate="firing"}`
   - **Title:** `{{alertname}}`
   - **Tags:** `severity`
   - **Text:** `{{instance}} - {{alertname}}`

This configuration displays annotation markers whenever an alert is firing, with the alert name as the title and the severity label as a tag.

## Example: Deployment markers

If you push deployment events to Prometheus using a push gateway or recording rule, you can display them as annotations:

1. Create an annotation query with the following settings:
   - **PromQL expression:** `deployment_timestamp_seconds`
   - **Series value as timestamp:** Enabled
   - **Title:** `Deployment`
   - **Tags:** `environment,version`
   - **Text:** `{{version}} deployed to {{environment}}`

Because **Series value as timestamp** is enabled, the metric value (the deployment timestamp) is used as the annotation time rather than the query evaluation time.

## Use template variables

You can use [template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/template-variables/) in your annotation PromQL expressions to make annotations dynamic. For example, `ALERTS{instance=~"$instance"}` filters alert annotations based on the selected instance variable.

## Get help

If your annotations aren't appearing or behaving as expected, refer to [Troubleshoot Prometheus data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/troubleshooting/) for common solutions.
