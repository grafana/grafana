---
aliases:
  - ../../features/panels/heatmap/
  - ../../visualizations/heatmap/
description: Configure options for Grafana's heatmap visualization
keywords:
  - grafana
  - heatmap
  - panel
  - documentation
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Heatmap
weight: 100
refs:
  intro-histograms-heatmaps:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/intro-histograms/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/intro-histograms/
  histograms:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/histogram/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/histogram/
  dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/create-dashboard/
---

# Heatmap

Heatmaps allow you to view [histograms](ref:histograms) over time. While histograms display the data distribution that falls in a specific value range, heatmaps allow you to identify patterns in the histogram data distribution over time. For more information about heatmaps, refer to [Introduction to histograms and heatmaps](ref:intro-histograms-heatmaps).

For example, if you want to understand the temperature changes for the past few years, you can use a heatmap visualization to identify trends in your data:

{{< figure src="/static/img/docs/heatmap-panel/temperature_heatmap.png" max-width="1025px" alt="A heatmap visualization showing the random walk distribution over time" >}}

{{< docs/play title="Grafana Heatmaps" url="https://play.grafana.org/d/heatmap-calculate-log/" >}}

You can use a heatmap visualization if you need to:

- Visualize a large density of your data distribution.
- Condense large amounts of data through various color schemes that are easier to interpret.
- Identify any outliers in your data distribution.
- Provide statistical analysis to see how values or trends change over time.

## Configure a heatmap visualization

Once you’ve created a [dashboard](ref:dashboards), the following video shows you how to configure a heatmap visualization:

{{< youtube id="SGWBzQ54koE" >}}

## Supported data formats

Heatmaps support time series data.

### Example

The table below is a simplified output of random walk distribution over time:

| Time                | Walking (km) |
| ------------------- | ------------ |
| 2023-06-25 21:13:09 | 10           |
| 2023-08-25 21:13:10 | 8            |
| 2023-08-30 21:13:10 | 10           |
| 2023-10-08 21:13:11 | 12           |
| 2023-12-25 21:13:11 | 14           |
| 2024-01-05 21:13:12 | 13           |
| 2024-02-22 21:13:13 | 10           |

The data is converted as follows:

{{< figure src="/static/img/docs/heatmap-panel/heatmap.png" max-width="1025px" alt="A heatmap visualization showing the random walk distribution over time" >}}

## Configuration options

{{< docs/shared lookup="visualizations/config-options-intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Heatmap options

The following options control how data in the heatmap is calculated and grouped.

<!-- prettier-ignore-start -->

| Options | Description |
| ------- | ----------- |
| Calculate from data | This setting determines if the data is already a calculated heatmap (from the data source/transformer), or one that should be calculated in the panel. |
| X Bucket | This setting determines how the x-axis is split into buckets. You can specify a time interval in the **Size** input. For example, a time range of `1h` makes the cells 1-hour wide on the x-axis. You can also set an interval based on **Count**.  |
| Y Bucket | This setting determines how the y-axis is split into buckets. Choose from **Size** or **Count**. |
| Y Bucket scale | Select one of the following y-axis value scales:<ul><li>**Linear** - Linear scale.</li><li>**Logarithmic** - Choose a **Log base** of **2** or **10**.</li><li>**Symlog** - Symlog scale. Choose a **Log base** of **2** or **10** and enter a value for the **Linear threshold**.</li></ul> |

<!-- prettier-ignore-end -->

### Y-Axis options

The following options define the display of the y-axis.

<!-- prettier-ignore-start -->

| Options | Description |
| ------- | ----------- |
| Placement | Set where the y-axis is displayed. Choose from: **Left**, **Right**, or **Hidden**. |
| Unit | Unit configuration. |
| Decimals | This setting determines decimal configuration. |
| Min/Max value | These settings configure the axis range. |
| Axis width | This setting configures the width for the axis. |
| Axis label | This setting configures the axis value. |
| Tick alignment | Sets the alignment of the tick marks on the visualization. Choose from: **Auto**, **Top (LE)**, **Middle**, and **Bottom (GE)**. This option is only displayed when your **Calculate from data** setting is **No**. |
| Reverse| When selected, the axis appears in reverse order. |

<!-- prettier-ignore-end -->

{{< docs/shared lookup="visualizations/multiple-y-axes.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+3" >}}

### Colors options

The color spectrum controls the mapping between value count (in each bucket) and the color assigned to each bucket. The leftmost color on the spectrum represents the minimum count and the color on the right most side represents the maximum count. Some color schemes are automatically inverted when using the light theme.

You can also change the color mode to Opacity. In this case, the color will not change but the amount of opacity will change with the bucket count

#### Mode

Use the following options to define the heatmap colors.

- **Scheme** - Bucket value represented by cell color.
  - **Scheme** - If the mode is **Scheme**, then select a color scheme.
- **Opacity** - Bucket value represented by cell opacity. Opaque cell means maximum value.
  - **Color** - Cell base color.
  - **Scale** - Scale for mapping bucket values to the opacity.
    - **Exponential** - Power scale. Cell opacity calculated as `value ^ k`, where `k` is a configured **Exponent** value. If exponent is less than `1`, you will get a logarithmic scale. If exponent is greater than `1`, you will get an exponential scale. In case of `1`, scale will be the same as linear.
      - **Exponent** - Value of the exponent, greater than `0`.
    - **Linear** - Linear scale. Bucket value maps linearly to the opacity.

#### Steps

Set a value between `1` and `128`.

#### Reverse

Toggle the switch to reverse the color scheme. This option only applies the **Scheme** color mode.

#### Start/end color scale from value

By default, Grafana calculates cell colors based on minimum and maximum bucket values. With Min and Max you can overwrite those values. Consider a bucket value as a Z-axis and Min and Max as Z-Min and Z-Max, respectively.

- **Start** - Minimum value using for cell color calculation. If the bucket value is less than Min, then it is mapped to the "minimum" color. The series min value is the default value.
- **End** - Maximum value using for cell color calculation. If the bucket value is greater than Max, then it is mapped to the "maximum" color. The series max value is the default value.

### Cell display options

Use these settings to control the display of heatmap cells.

<!-- prettier-ignore-start -->

| Option | Description |
| ------ | ----------- |
| Unit | Unit configuration. |
| Decimals | This setting determines decimal configuration. |
| Cell gap | Set how much space there is between cells. |
| Hide cells with values <= | Enter a value. |
| Hide cells with values >= | Enter a value. |

<!-- prettier-ignore-end -->

### Tooltip options

Tooltip options control the information overlay that appears when you hover over data points in the visualization.

| Option                                | Description                                                                                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Tooltip mode](#tooltip-mode)         | When you hover your cursor over the visualization, Grafana can display tooltips. Choose how tooltips behave.                                                             |
| Show histogram (Y axis)               | When you set the **Tooltip mode** to **Single**, this option is displayed. This option controls whether or not the tooltip includes a histogram representing the y-axis. |
| [Show color scale](#show-color-scale) | This option controls whether or not the tooltip includes the color scale that's also represented in the legend.                                                          |
| Max width                             | Set the maximum width of the tooltip box.                                                                                                                                |
| Max height                            | Set the maximum height of the tooltip box. The default is 600 pixels.                                                                                                    |

#### Tooltip mode

When you hover your cursor over the visualization, Grafana can display tooltips. Choose how tooltips behave.

- **Single -** The hover tooltip shows only a single series, the one that you are hovering over on the visualization.
- **All -** The hover tooltip shows all series in the visualization. Grafana highlights the series that you are hovering over in bold in the series list in the tooltip.
- **Hidden -** Do not display the tooltip when you interact with the visualization.

Use an override to hide individual series from the tooltip.

#### Show color scale

When you set the **Tooltip mode** to **Single**, this option is displayed. This option controls whether or not the tooltip includes the color scale that's also represented in the legend. When the color scale is included in the tooltip, it shows the hovered value on the scale:

![Heatmap with a tooltip displayed showing the hovered value reflected in the color scale](/media/docs/grafana/panels-visualizations/screenshot-heatmap-tooltip-color-scale-v11.0.png)

### Legend options

Choose whether you want to display the heatmap legend on the visualization by toggling the **Show legend** switch.

### Exemplars

Set the color used to show exemplar data.

### Data links

{{< docs/shared lookup="visualizations/datalink-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
