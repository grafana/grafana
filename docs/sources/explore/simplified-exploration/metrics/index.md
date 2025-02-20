---
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Metrics Drilldown
aliases:
  - ../explore-metrics/ # /docs/grafana/latest/explore/explore-metrics/
canonical: https://grafana.com/docs/grafana/latest/explore/simplified-exploration/metrics/
description: Grafana Metrics Drilldown lets you browse Prometheus-compatible metrics using an intuitive, queryless experience.
weight: 200
---

# Grafana Metrics Drilldown

Grafana Metrics Drilldown is a query-less experience for browsing **Prometheus-compatible** metrics. Quickly find related metrics with just a few simple clicks, without needing to write PromQL queries to retrieve metrics.

{{< docs/shared source="grafana" lookup="plugins/rename-note.md" version="<GRAFANA_VERSION>" >}}

With Metrics Drilldown, you can:

- Easily segment metrics based on their labels, so you can immediately spot anomalies and identify issues.
- Automatically display the optimal visualization for each metric type (gauge vs. counter, for example) without manual setup.
- Uncover related metrics relevant to the one you're viewing.
- “Explore in a drawer” - overlay additional content on your dashboard without losing your current view.
- View a history of user steps when navigating through metrics and their filters.
- Seamlessly pivot to related telemetry, including log data.

{{< docs/play title="Metrics Drilldown" url="https://play.grafana.org/explore/metrics/trail?from=now-1h&to=now&var-ds=grafanacloud-demoinfra-prom&var-filters=&refresh=&metricPrefix=all" >}}

You can access Metrics Drilldown either as a standalone experience or as part of Grafana dashboards.

## Standalone experience

To access Metrics Drilldown as a standalone experience:

1. Click the arrow next to **Drilldown** in the Grafana left-side menu and click **Metrics**. You are taken to an overview page that shows recent metrics, bookmarks, and the option to select a new metric exploration.
1. To get started with a new exploration, click **Let's start!**.
1. Select **Prometheus** or any Prometheus-compatible data source available in the drop-down menu under **Data source**.
1. Click **+ Add label** to select a label-value pair from the drop-down menu. You can add multiple label-value pairs. A label type appears above the selected label with a drop-down list of options from which to choose. For example, if you select the label `container` a drop-down list of available containers appears.
1. You can also search for metrics using keywords under **Search metrics** in the search bar.
1. Use the time picker to select a date and time range from the drop-down menu or use an absolute time range.
1. Click the down arrow next to the **Refresh** icon to set a refresh rate from the drop-down menu. The default is `Off`.

The **History** button in the upper left corner tracks every step navigating through metric exploration.

![show metrics explore overview](/media/metrics-explore/metrics-drilldown-overview.png)

### Metrics exploration

To further explore a metric, click **Select** in the upper right corner of the metric visualization.

![show select box](/media/metrics-explore/select-metric.png)

- The **Overview** tab provides a description for each metric, as well as the metric `type` and `unit` associated with the metric. It also provides a list of labels associated with the metric. Click on any label to view drill-down visualizations.
- The **Breakdown** tab depicts time series visualizations for each of the label-value pairs for the selected metric. You can further drill down on each label and click **Add to filter** to add the label/value pair into your filters. You can also change the **View** from grid to rows.
- The **Related metrics** tab depicts related metrics with relevant key words. You can repeat the drill down process for any related metric. Toggle **Show previews** to preview visualizations.

After you have gathered your metrics exploration data you can:

- Click the **Open in Explore** icon on the right side to open the graph in Explore, where you can modify the query or add the graph to a dashboard or incident.
- Click the **Copy URL** icon on the right side to copy the metric drill down URL to the clipboard so it can be shared.
- Click the **Star** icon on the right side to bookmark and save the metrics exploration.

## Dashboard experience

To access Metrics Drilldown via a dashboard:

1. Navigate to your dashboard.
1. Select a time series panel.
1. Click the panel menu in the upper right and select **Metrics Drilldown**. If there are multiple metrics, click on the one you want to explore.
1. You see a slide out drawer with the Metrics Experience, starting with the drill down. You can access the standalone experience by clicking **Open** in the upper right.
