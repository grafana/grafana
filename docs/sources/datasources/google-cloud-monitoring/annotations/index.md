---
aliases:
  - ../../data-sources/google-cloud-monitoring/annotations/
description: Use annotations to overlay Google Cloud Monitoring events on Grafana graphs
keywords:
  - grafana
  - google
  - cloud
  - monitoring
  - annotations
  - events
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Annotations
title: Google Cloud Monitoring annotations
weight: 400
---

# Google Cloud Monitoring annotations

[Annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/) overlay rich event information on top of graphs. You can use annotations to mark important events, deployments, or incidents on your dashboards.

## Before you begin

Before you configure annotations, ensure you have the following:

- A configured Google Cloud Monitoring data source.
- A dashboard where you want to add annotations.

## Annotation limitations

Keep the following limitations in mind when using annotations:

- **Performance:** Rendering annotations is expensive. Limit the number of rows returned to maintain dashboard performance.
- **Native events:** There's no support for displaying Google Cloud Monitoring's native annotations and events. However, annotations work well with [custom metrics](https://cloud.google.com/monitoring/custom-metrics/) in Google Cloud Monitoring.

## Add an annotation query

To add an annotation query to a dashboard:

1. Navigate to the dashboard you want to update and click **Edit**.
1. Click the **Add new element** icon (blue plus sign).
1. Click **Annotation query**.
1. Enter a name for the annotation query.
1. If you don't want to use the annotation query right away, clear the **Enabled** checkbox.
1. Select a color for the annotation event markers.
1. Select an option in the **Show annotation controls in** drop-down list to control where on the dashboard the annotation is displayed.
1. Select an option in the **Show in** drop-down list to control the panels in which the annotation is displayed.
1. Click **Open query editor** to open the **Annotation Query** dialog box.
1. Select your Google Cloud Monitoring data source from the **Data source** drop-down list.
1. Configure the annotation query and field mappings.
1. (Optional) Click **Test annotation query** to ensure that the query is working properly.
1. Click **Close** when you've completed the query setup.
1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

## Configure the annotation query

With the query editor for annotations, you can select a metric and filters to define which data points create annotations.

The **Title** and **Text** fields support templating and can use data returned from the query.

For example, the Title field could have the following text:

`{{metric.type}} has value: {{metric.value}}`

Example result: `monitoring.googleapis.com/uptime_check/http_status has this value: 502`

## Annotation patterns

Use the following patterns in the **Title** and **Text** fields to display metric data in your annotations:

| Pattern format           | Description                       | Example                          | Result                                            |
| ------------------------ | --------------------------------- | -------------------------------- | ------------------------------------------------- |
| `{{metric.value}}`       | Value of the metric/point.        | `{{metric.value}}`               | `555`                                             |
| `{{metric.type}}`        | Returns the full Metric Type.     | `{{metric.type}}`                | `compute.googleapis.com/instance/cpu/utilization` |
| `{{metric.name}}`        | Returns the metric name part.     | `{{metric.name}}`                | `instance/cpu/utilization`                        |
| `{{metric.service}}`     | Returns the service part.         | `{{metric.service}}`             | `compute`                                         |
| `{{metric.label.xxx}}`   | Returns the metric label value.   | `{{metric.label.instance_name}}` | `grafana-1-prod`                                  |
| `{{resource.label.xxx}}` | Returns the resource label value. | `{{resource.label.zone}}`        | `us-east1-b`                                      |

## Example: Annotate uptime check failures

To create annotations for uptime check failures:

1. Add an annotation query using the Google Cloud Monitoring data source.
1. Select the `monitoring.googleapis.com/uptime_check/check_passed` metric.
1. Add a filter for `check_passed = false`.
1. Set the **Title** to: `Uptime check failed: {{metric.label.check_id}}`
1. Set the **Text** to: `Region: {{resource.label.zone}}`

This creates an annotation marker on your graph each time an uptime check fails.
