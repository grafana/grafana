---
aliases:
  - ../panels/
  - ../panels/configure-thresholds/
  - ../panels/specify-thresholds/about-thresholds/
  - ../panels/specify-thresholds/add-a-threshold/
  - ../panels/specify-thresholds/add-threshold-to-graph/
  - ../panels/specify-thresholds/delete-a-threshold/
  - ../panels/thresholds/
description: Configure thresholds in your visualizations
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure thresholds
title: Configure thresholds
weight: 100
---

# Configure thresholds

A threshold is a value that you specify for a metric that's visually reflected in a dashboard when the threshold value is met or exceeded.

<!--this definition needs to be clearer-->

Thresholds are one way you can conditionally style and color your visualizations based on query results. You can use thresholds to:

- Color grid lines or grid areas in the [Time-series visualization][]
- Color lines in the [Time-series visualization][]
- Color the background or value text in the [Stat visualization][]
- Color the gauge and threshold markers in the [Gauge visualization][]
- Color markers in the [Geomap visualization][]
- Color cell text or background in the [Table visualization][]
- Define regions and region colors in the [State timeline visualization][]

<!--Maybe have fewer of these examples but actually show what these examples would look like visually -->

## Supported visualizations

Thresholds are supported for the following visualizations:

- [Bar chart][bar chart]
- [Bar gauge][bar gauge]
- [Candlestick][candlestick]
- [Canvas][canvas]
- [Gauge][gauge]
- [Geomap][geomap]
- [Histogram][histogram]
- [Stat][stat]
- [State timeline][state timeline]
- [Status history][status history]
- [Table][table]
- [Time series][time series]
- [Trend][trend]

## Default thresholds

On visualizations that support thresholds, Grafana has the following default threshold settings:

- 80 = red
- Base = green
- Mode = Absolute
- Show thresholds = Off (for some visualizations); for more information, see the [Show thresholds](#show-threshold) option.

## Threshold options

You can set the following options to further define how thresholds look.

{{< admonition type="note" >}}
Not all of the options listed apply to all visualizations with thresholds.
{{< /admonition >}}

### Threshold value

This number is the value that triggers the threshold. You can also set the color associated with the threshold in this field.

The **Base** value represents minus infinity. By default, it's set to the color green, which is generally the “good” color.

### Threshold mode

There are two threshold modes:

- **Absolute** thresholds are defined by a number. For example, 80 on a scale of 1 to 150.
- **Percentage** thresholds are defined relative to minimum or maximum. For example, 80 percent.

### Show threshold

Set how thresholds are displayed with the following options:

- **Off** - Don't show thresholds.
- **As lines**
- **As lines (dashed)**
- **As filled regions**
- **As filled regions and lines**
- **As filled regions and lines (dashed)**

This option is supported for the following visualizations:

- Bar chart
- Candlestick
- Time series
- Trend

## Add a threshold

You can add as many thresholds to a visualization as you want. Grafana automatically sorts thresholds values from highest to lowest.

1. Navigate to the panel you want to update.
1. Hover over any part of the panel you want to work on to display the menu on the top right corner.
1. Click the menu and select **Edit**.
1. Scroll to the **Thresholds** section of the panel edit pane.
1. Click **+ Add threshold**.

   A new threshold 10 units higher than the default threshold is added.

1. Enter a new threshold value or use the up and down arrows at the right side of the field to increase or decrease the value incrementally.
1. Click the colored circle to the left of the threshold value to open the color picker, where you can update the threshold color.
1. Under **Thresholds mode**, select either **Absolute** or **Percentage**.
1. Under **Show thresholds**, set how the threshold is displayed or turn it off.

Delete a threshold when it's no longer needed. When you delete a threshold, the system removes the threshold from all visualizations that include the threshold.

To delete a threshold, navigate to the panel that contains the threshold and click the trash icon next to the threshold you want to remove.

## Add a threshold to a legacy graph panel

<!--do we still need this section-->

In the Graph panel visualization, thresholds enable you to add lines or sections to a graph to make it easier to recognize when the graph crosses a threshold.

1. Navigate to the graph panel to which you want to add a threshold.
1. On the **Panel** tab, click **Thresholds**.
1. Click **Add threshold**.
1. Complete the following fields:
   - **T1 -** Both values are required to display a threshold.
     - **lt** or **gt** - Select **lt** for less than or **gt** for greater than to indicate what the threshold applies to.
     - **Value -** Enter a threshold value. Grafana draws a threshold line along the Y-axis at that value.
   - **Color -** Choose a condition that corresponds to a color, or define your own color.
     - **custom -** You define the fill color and line color.
     - **critical -** Fill and line color are red.
     - **warning -** Fill and line color are yellow.
     - **ok -** Fill and line color are green.
   - **Fill -** Toggle the display of the threshold fill.
   - **Line -** Toggle the display of the threshold line.
   - **Y-Axis -** Choose to display the y-axis on either the **left** or **right** of the panel.
1. Click **Save** to save the changes in the dashboard.

{{% docs/reference %}}
[bar chart]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/bar-chart"
[bar chart]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/bar-chart"

[bar gauge]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/bar-gauge"
[bar gauge]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/bar-gauge"

[candlestick]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/candlestick"
[candlestick]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/candlestick"

[canvas]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/canvas"
[canvas]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/canvas"

[gauge]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/gauge"
[gauge]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/gauge"

[geomap]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/geomap"
[geomap]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/geomap"

[histogram]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/histogram"
[histogram]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/histogram"

[stat]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/stat"
[stat]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/stat"

[state timeline]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/state-timeline"
[state timeline]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/state-timeline"

[status history]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/status-history"
[status history]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/status-history"

[table]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/table"
[table]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/table"

[time series]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/time-series"
[time series]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/time-series"

[trend]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/trend"
[trend]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/trend"

[Time-series visualization]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/time-series#from-thresholds"
[Time-series visualization]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/time-series#from-thresholds"

[Stat visualization]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/stat"
[Stat visualization]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/stat"

[Gauge visualization]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/gauge"
[Gauge visualization]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/gauge"

[Geomap visualization]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/gauge"
[Geomap visualization]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/gauge"

[Table visualization]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/table"
[Table visualization]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/table"

[State timeline visualization]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/visualizations/state-timeline"
[State timeline visualization]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/state-timeline"
{{% /docs/reference %}}
