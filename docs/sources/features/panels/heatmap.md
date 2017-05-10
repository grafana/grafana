+++
title = "Heatmap Panel"
description = "Heatmap panel documentation"
keywords = ["grafana", "heatmap", "panel", "documentation"]
type = "docs"
[menu.docs]
parent = "panels"
weight = 3
+++

# Heatmap Panel

> New panel only available in Grafana v4.3+

![](/img/docs/v43/heatmap_panel.png)

The Heatmap panel allows you to view histograms over time.

## Histograms and buckets

A histogram is a graphical representation of the distribution of numerical data. You group values into buckets
(some times also called bins) and then count how many values fall into each bucket. Instead
of graphing the actual values you then graph the buckets. Each each bar represents a bucket
and the bar height represents the frequency (i.e. count) of values that fell into that bucket's interval.

Example Histogram:

![](/img/docs/v43/heatmap_histogram.png)

The above histogram shows us that most value distribution of a couple of time series. We can easily see that
most values land between 240-300 with a peak between 260-280. Histograms just look at value distributions
over specific time range. So you cannot see any trend or changes in the distribution over time,
this is where heatmaps become useful.

## Heatmap

A Heatmap is like a histogram but over time where each time slice represents it's own
histogram. Instead of using bar hight as a represenation of frequency you use a cells and color
the cell propotional to the number of values in the bucket.

Example:

![](/img/docs/v43/heatmap_histogram_over_time.png)

Here we can clearly see what values are more common and how they trend over time.

## Data Options

Data and bucket options can be found in the `Axes` tab.

### Data Formats

Data format | Description
------------ | -------------
*Time series* | Grafana does the bucketing by going through all time series values. The bucket sizes & intervals will be determined using the Buckets options.
*Time series buckets* | Each time series already represents a Y-Axis bucket. The time series name (alias) needs to be a numeric value representing the upper interval for the bucket. Grafana does no bucketing so the bucket size options are hidden.

### Bucket Size

The Bucket count & size options are used by Grafana to calculate how big each cell in the heatmap is. You can
define the bucket size either by count (the first input box) or by specifying a size interval. For the Y-Axis
the size interval is just a value but for the X-bucket you can specify a time range in the *Size* input, for example,
the time range `1h`.  This will make the cells 1h wide on the X-axis.

### Pre-bucketed data

If you have a data that is already organized into buckets you can use the `Time series buckets` data format. This
format requires that your metric query return regular time series and that each time series has numeric name
that represent the upper or lower bound of the interval.

The only data source that supports histograms over time is Elasticsearch. You do this by adding a *Histogram*
bucket aggregation before the *Date Histogram*.

![](/img/docs/v43/elastic_histogram.png)

You control the size of the buckets using the Histogram interval (Y-Axis) and the Date Histogram interval (X-axis).

## Display Options

The color spectrum controls what value get's assigned what color. The left most color on the
spectrum represents the low frequency and the color on the right most side represents the max frequency.
Most color schemes are automatically inverted when using the light theme.

