+++
title = "Heatmap"
description = "Heatmap visualization documentation"
keywords = ["grafana", "heatmap", "panel", "documentation"]
type = "docs"
aliases =["/docs/grafana/latest/features/panels/heatmap/"]
[menu.docs]
name = "Heatmap"
parent = "visualizations"
weight = 700
draft = "true"
+++

# Heatmap

The Heatmap panel visualization allows you to view histograms over time. For more information about histograms, refer to [Introduction to histograms and heatmaps]({{< relref "../../getting-started/intro-histograms.md" >}}).

![](/img/docs/v43/heatmap_panel_cover.jpg)

## Axes options
Use these settings to adjust how axes are displayed in your visualization.

### Y Axis

- **Unit -**
- **Scale -**
  - **linear -**
  - **log (base 2) -**
  - **log (base 10) -**
  - **log (base 32) -**
  - **log (base 1024) -**
- **Y-Min -**
- **Y-Max -**
- **Decimals -**

### Buckets

> **Note:** If the data format is **Time series buckets**, then this section will not be available.

- **Y Axis Buckets -**
- **Size -** (Only visible if **Scale** is _linear_)
- **Split Factor -** (Only visible if **Scale** is _log (base 2)_ or greater)
- **X Axis Buckets -**
- **Size -**

#### Bucket bound

When Data format is Time series buckets data source returns series with names representing bucket bound. But depending on data source, a bound may be upper or lower. This option allows to adjust a bound type. If Auto is set, a bound option will be chosen based on panels’ data source type.

#### Bucket size

The Bucket count and size options are used by Grafana to calculate how big each cell in the heatmap is. You can define the bucket size either by count (the first input box) or by specifying a size interval. For the Y-Axis the size interval is just a value but for the X-bucket you can specify a time range in the Size input, for example, the time range 1h. This will make the cells 1h wide on the X-axis.

#### Data format

Choose an option in the **Format** list.
- **Time series -** Grafana does the bucketing by going through all time series values. The bucket sizes and intervals are set in the Buckets options.
- **Time series buckets -** Each time series already represents a Y-Axis bucket. The time series name (alias) needs to be a numeric value representing the upper or lower interval for the bucket. Grafana does no bucketing, so the bucket size options are hidden.

## Display options

Use these settings to refine your visualization.

### Colors

The color spectrum controls the mapping between value count (in each bucket) and the color assigned to each bucket. The leftmost color on the spectrum represents the minimum count and the color on the right most side represents the maximum count. Some color schemes are automatically inverted when using the light theme.

You can also change the color mode to Opacity. In this case, the color will not change but the amount of opacity will change with the bucket count

- **Mode**
  - **opacity -**
    - **Color -**
    - **Scale -**
      - **sqrt -**
      - **linear -**
    - **Exponent -**
  - **spectrum -**
    - **Scheme -** If the mode is **spectrum**, then select a color scheme.

### Color scale

- **Min -**
- **Max -**


### Legend

Choose whether to display the heatmap legend on the visualization or not.

### Buckets

- **Hide zero -**
- **Space -**
- **Round -**

### Tooltip

- **Show tooltip -**
- **Histogram -**
- **Decimals -**
