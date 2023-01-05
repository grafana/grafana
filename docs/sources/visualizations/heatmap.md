---
aliases:
  - ../features/panels/heatmap/
description: Heatmap visualization documentation
keywords:
  - grafana
  - heatmap
  - panel
  - documentation
title: Heatmap
weight: 600
---

# Heatmap

The Heatmap panel visualization allows you to view histograms over time. For more information about histograms, refer to [Introduction to histograms and heatmaps]({{< relref "../basics/intro-histograms.md" >}}).

![](/static/img/docs/v43/heatmap_panel_cover.jpg)

## Axes options

Use these settings to adjust how axes are displayed in your visualization.

### Y Axis

- **Unit -** The display unit for the Y axis value
- **Scale -** The scale to use for the Y axis value.
  - **linear -** Linear scale.
  - **log (base 2) -** Logarithmic scale with base 2.
  - **log (base 10) -** Logarithmic scale with base 10.
  - **log (base 32) -** Logarithmic scale with base 32.
  - **log (base 1024) -** Logarithmic scale with base 1024.
- **Y-Min -** The minimum Y value (default auto).
- **Y-Max -** The maximum Y value (default auto).
- **Decimals -** Number of decimals to render Y axis values with (default auto).

### Buckets

> **Note:** If the data format is **Time series buckets**, then this section will not be available.

- **Y Axis Buckets -** Number of buckets Y axis will be split into.
- **Size -** (Only visible if **Scale** is _linear_). Size of each Y axis bucket. This option has priority over **Y Axis Buckets**.
- **Split Factor -** (Only visible if **Scale** is _log (base 2)_ or greater). By default Grafana splits Y values by log base. This option allows to split each default bucket into specified number of buckets.
- **X Axis Buckets -** Number of buckets X axis will be split into.
- **Size -** Size of each X axis bucket. Number or time interval (10s, 5m, 1h, etc). Supported intervals: ms, s, m, h, d, w, M, y. This option has priority over **X Axis Buckets**.

#### Bucket bound

When Data format is Time series buckets data source returns series with names representing bucket bound. But depending on data source, a bound may be upper or lower. This option allows to adjust a bound type. If Auto is set, a bound option will be chosen based on panels’ data source type.

#### Bucket size

The Bucket count and size options are used by Grafana to calculate how big each cell in the heatmap is. You can define the bucket size either by count (the first input box) or by specifying a size interval. For the Y-Axis the size interval is just a value but for the X-bucket you can specify a time interval in the Size input, for example, the time range 1h. This will make the cells 1h wide on the X-axis.

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
  - **opacity -** Bucket value represented by cell opacity. Opaque cell means maximum value.
    - **Color -** Cell base color.
    - **Scale -** Scale for mapping bucket values to the opacity.
      - **linear -** Linear scale. Bucket value maps linearly to the opacity.
      - **sqrt -** Power scale. Cell opacity calculated as `value ^ k`, where `k` is a configured **Exponent** value. If exponent is less than `1`, you will get a logarithmic scale. If exponent is greater than `1`, you will get an exponential scale. In case of `1`, scale will be the same as linear.
    - **Exponent -** value of the exponent, greater than `0`.
  - **spectrum -** Bucket value represented by cell color.
    - **Scheme -** If the mode is **spectrum**, then select a color scheme.

### Color scale

By default, Grafana calculates cell colors based on minimum and maximum buckets values. With Min and Max you can overwrite those values. Think of a bucket value as a Z-axis and Min and Max as Z-Min and Z-Max respectively.

- **Min -** Minimum value using for cell color calculation. If the bucket value is less than Min, then it is mapped to the "minimum" color. Default is series min value.
- **Max -** Maximum value using for cell color calculation. If the bucket value is greater than Max, then it is mapped to the "maximum" color. Default is series max value.

### Legend

Choose whether to display the heatmap legend on the visualization or not.

### Buckets

- **Hide zero -** Do not draw cells with zero values.
- **Space -** Space in pixels between cells. Default is 1 pixel.
- **Round -** Cell roundness in pixels. Default is 0.

### Tooltip

- **Show tooltip -** Show heatmap tooltip.
- **Histogram -** Show Y axis histogram on the tooltip. Histogram represents distribution of the bucket values for the specific timestamp.
- **Decimals -** Number of decimals to render bucket value with (default auto).
