---
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Grafana Metrics Explore
aliases: 
description: 
weight: 200
---

# Grafana Metrics Explore

Grafana Metrics Explore is a query-less experience for browsing Prometheus-compatible metrics. Search for or filter to find a metric. Quickly find related metrics - all in just a few clicks. No PromQL to be found anywhere! With Explore Metrics, you can:

easily slice and dice metrics based on their labels, so you can see anomalies right away
See the right visualization for your metric based on its type (e.g. gauge vs. counter) without writing it yourself
surface other metrics relevant to the current metric
“explore in a drawer” - expand a drawer over a dashboard with more content, so you don’t lose your place
view a history of user steps when navigating through metrics and their filters
easily pivot to other related telemetry - IE, logs or traces 

… all without writing any queries!

You can access Metrics Explore either as a standalone experience or as part of our Dashboards. 

Standalone experience

Click on Explore > Metrics in the main navigation bar
You’ll land on an overview page that shows a time series visualization for all of the metrics in your default Prometheus instance
Change your data source with the drop-down on the top right
You can change your data source with the Select Prometheus-compatible data source (and we only show these in the data sources for you in the drop-down). 
Basic controls
You can modify your time range in two ways: 
With the standard time range picker on the top left
By dragging and dropping the time range you want to see on any time series visualization
Refresh Metrics Explore time interval
Click to select a dashboard auto refresh time interval
Settings
Select Always keep selected metric graph in-view to keep your main graph always in view on the Breakdown drill down tab (in-page link)
Narrow down your results
Filter label / value pairs
Use the drop down on the top right to filter your results by relevant label-value pairs 
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
Additional functionality
There is additional functionality in this section of the product, which include: 
Explore
Clicking on the Explore icon will open the graph in Explore, where you’ll be able to modify the query or add the graph to a dashboard or incident
Share
Clicking on the Share icon, will copy the URL of your drill down to your clipboard so you can easily share it
Bookmark
Clicking on the Star icon, will save your exploration so that you can come back to it later.
Bookmarks & Recents
You can access all of your Bookmarks by click Explore > Metrics on the main navigation
You can also see your recent metrics explorations on this page.

Dashboards experience

To access the Metrics Explore experience via a dashboard

Navigate to your dashboard
Identify a Time Series panel
Click on Explore Metrics in the panel menu
If there are multiple metrics, click on the one you want to explore

You will see a slideout drawer with the Metrics Experience, starting with the drill down. You can access the standalone experience by clicking the Open button on the upper right.