+++
title = "Histograms and heatmaps"
description = "An introduction to histograms and heatmaps"
keywords = ["grafana", "heatmap", "panel", "documentation", "histogram"]
type = "docs"
[menu.docs]
name = "intro-to-histograms"
parent = "panels"
weight = 400
+++

# Introduction to histograms and heatmaps

A histogram is a graphical representation of the distribution of numerical data. It groups values into buckets
(sometimes also called bins) and then counts how many values fall into each bucket.

Instead of graphing the actual values, histograms graph the buckets. Each bar represents a bucket,
and the bar height represents the frequency (such as count) of values that fell into that bucket's interval.

## Histogram example

This histogram shows the value distribution of a couple of time series. You can easily see that
most values land between 240-300 with a peak between 260-280.

![](/img/docs/v43/heatmap_histogram.png)

Histograms only look at _value distributions_ over a specific time range. The problem with histograms is you cannot see any trend or changes in the distribution over time.
This is where heatmaps become useful.

## Heatmaps

A _heatmap_ is like a histogram, but over time where each time slice represents its own histogram. Instead of using bar height as a representation of frequency, it uses cells and colors the cell proportional to the number of values in the bucket.

In this example, you can clearly see what values are more common and how they trend over time.

![](/img/docs/v43/heatmap_histogram_over_time.png)

## Pre-bucketed data

There are a number of data sources supporting histogram over time like Elasticsearch (by using a Histogram bucket
aggregation) or Prometheus (with [histogram](https://prometheus.io/docs/concepts/metric_types/#histogram) metric type
and *Format as* option set to Heatmap). But generally, any data source could be used if it meets the requirements:
returns series with names representing bucket bound or returns series sorted by the bound in ascending order.

## Raw data vs aggregated

If you use the heatmap with regular time series data (not pre-bucketed), then it's important to keep in mind that your data
is often already aggregated by your time series backend. Most time series queries do not return raw sample data
but include a group by time interval or maxDataPoints limit coupled with an aggregation function (usually average).

This all depends on the time range of your query of course. But the important point is to know that the histogram bucketing
that Grafana performs might be done on already aggregated and averaged data. To get more accurate heatmaps it is better
to do the bucketing during metric collection or store the data in Elasticsearch, or in the other data source which
supports doing histogram bucketing on the raw data.

If you remove or lower the group by time (or raise maxDataPoints) in your query to return more data points your heatmap will be
more accurate but this can also be very CPU and memory taxing for your browser and could cause hangs and crashes if the number of
data points becomes unreasonably large.
