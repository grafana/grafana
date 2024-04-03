---
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Grafana Metrics Explore
aliases: 
description: This doc describes the Metrics Explore feature
weight: 200
---

# Grafana Metrics Explore

Grafana Metrics Explore is a query-less experience for browsing Prometheus-compatible metrics. Search for or filter to find a metric. Quickly find related metrics with just a few simple clicks. A key feature of Metrics Explore is that you don't need to learn PromQL to retrieve metrics.

{{% admonition type="warning" %}}
Metric Explore is currently in [private preview](/docs/release-life-cycle/). Grafana Labs offers support on a best-effort basis, and breaking changes might occur prior to the feature being made generally available.
{{% /admonition %}}

With Explore Metrics, you can:

- easily slice and dice metrics based on their labels, so you can see anomalies right away
- see the right visualization for your metric based on its type (e.g. gauge vs. counter) without writing it yourself
- surface other metrics relevant to the current metric
- “explore in a drawer” - expand a drawer over a dashboard with more content, so you don’t lose your place
- view a history of user steps when navigating through metrics and their filters
- easily pivot to other related telemetry - IE, logs or traces 

You can do all of these things without writing a single query!

You can access Metrics Explore either as a standalone experience or as part of Grafana Dashboards. 

## Standalone experience

To access Metrics Explore as a standalone experience:

1. Click the arrow next to **Explore** in the Grafana left-side menu and click **Metrics**. You will be taken to an overview page that shows recent metrics, bookmarks, and the option to select a new metric exploration.
1. Click **+ New metric exploration**.
1. Select **Prometheus** in the drop-down menu under **Data source**. You can also select a Prometheus-compatible data source available in the list.
1. Click **+ Add label** to select a label from the drop-down menu. You can add multiple labels.  A label type will appear above the label with a drop-down of options. For example, if you select the label `container` a drop-down list of available containers appears.
1. You can also search for metrics under **Search metrics**. 
1. Use the time picker to select a date and time range from the drop-down menu or use an absolute time range. 
1. Click the arrow next to the **Refresh** icon to set a refresh rate from the drop-down menu. The default is `Off`. 
1. Click the **Settings** icon and toggle **Always keep selected metric graph in-view** to keep your main graph always in view on the Breakdown drill-down tab. 


{{< admonition type="note" >}}
The **History** button in the upper left maps all the steps when navigating through metrics and their filters.   `ask how this works, it's a bit wonky when I play around with it`
{{< /admonition >}}

### Metrics exploration

To further explore a metric, click **Select** in the upper right of the metric visualization.

![show select box](/media/metrics-explore/select-metric.png)

- The **Overview** tab provides a description for each metric, as well as the metric `type` and `unit` associated with the metric. It also provides a list of labels associated with the metric.
- The **Breakdown** tab depicts time series visualizations for each of the label-value pairs for the selected metric. You can further drill down and **Add to filter** - `ask for more info about this from Mary!`
- The **Related metrics** tab depicts any other metrics with relevant key words. You can repeat the drill down process for any related metric and see all of the preceding tabs. 

Once you have the information you need you can:

- click the **Explore** icon on the right side to open the graph in Explore, where you can modify the query or add the graph to a dashboard or incident.

- click the **Share** icon on the right side to copy the metric drill down URL to the clipboard so it can be shared.

- click the **Star** icon on the right side to bookmark and save the metrics exploration.



Narrow down your results
Filter label / value pairs
Use the drop-down on the top right to filter your results by relevant label-value pairs 
Keyword search
The search bar allows you to search your metrics via keyword
Explain which type of query displays on which type of metric
Bucket = 
Gauge = 
Counter = 
Etc
Etc
etc
Find the metrics you want to explore in more detail
Once you identify the metric you want to explore, click the select button on the upper right of the panel
Drill down into your metric
Once you’ve selected the metric you want to explore, you will see a large graph with three tabs below:
Overview
On this tab, you’ll see key data about your selected metric: 
The metric type, description, unit and labels
Breakdown
On this tab, you’ll see time series visualizations for each label-value pairs for your selected metric. 
You can view all of the label-value pairs or drill into specific labels
You can also select Add to filters to add a specific label-value pair to your filters
Related metrics
The related metrics tab shows other metrics with relevant keywords



Bookmarks & Recents
You can access all of your Bookmarks by click Explore > Metrics on the main navigation
You can also see your recent metrics explorations on this page.

## Dashboards experience

To access the Metrics Explore experience via a dashboard

Navigate to your dashboard
Identify a Time Series panel
Click on Explore Metrics in the panel menu
If there are multiple metrics, click on the one you want to explore

You will see a slideout drawer with the Metrics Experience, starting with the drill down. You can access the standalone experience by clicking the Open button on the upper right.