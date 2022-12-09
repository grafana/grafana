---
aliases:
  - ../panels/
  - ../panels/configure-thresholds/
  - ../panels/specify-thresholds/about-thresholds/
  - ../panels/specify-thresholds/add-a-threshold/
  - ../panels/specify-thresholds/add-threshold-to-graph/
  - ../panels/specify-thresholds/delete-a-threshold/
  - ../panels/thresholds/
description: This section includes information about using thresholds in your visualizations.
menuTitle: Configure thresholds
title: Configure thresholds
weight: 300
---

# Configure thresholds

This section includes information about using thresholds in your visualizations. You'll learn about thresholds and their defaults, how to add or delete a threshold, and adding a threshold to a legacy panel.

## About thresholds

A threshold is a value that you specify for a metric that is visually reflected in a dashboard when the threshold value is met or exceeded.

Thresholds provide one method for you to conditionally style and color your visualizations based on query results. You can apply thresholds to most, but not all, visualizations. For more information about visualizations, refer to [Visualization panels]({{< relref "../visualizations/" >}}).

You can use thresholds to:

- Color grid lines or grid ares areas in the [Time-series visualization]({{< relref "../visualizations/time-series/" >}})
- Color lines in the [Time-series visualization]({{< relref "../visualizations/time-series#from-thresholds" >}})
- Color the background or value text in the [Stat visualization]({{< relref "../visualizations/stat/" >}})
- Color the gauge and threshold markers in the [Gauge visualization]({{< relref "../visualizations/gauge/" >}})
- Color markers in the [Geomap visualization]({{< relref "../visualizations/geomap/" >}})
- Color cell text or background in the [Table visualization]({{< relref "../visualizations/table/" >}})
- Define regions and region colors in the [State timeline visualization]({{< relref "../visualizations/state-timeline/" >}})

There are two types of thresholds:

- **Absolute** thresholds are defined by a number. For example, 80 on a scale of 1 to 150.
- **Percentage** thresholds are defined relative to minimum or maximum. For example, 80 percent.

### Default thresholds

On visualizations that support it, Grafana sets default threshold values of:

- 80 = red
- Base = green
- Mode = Absolute

The **Base** value represents minus infinity. It is generally the “good” color.

## Add or delete a threshold

You can add as many thresholds to a panel as you want. Grafana automatically sorts thresholds values from highest to lowest.

Delete a threshold when it is no longer relevant to your business operations. When you delete a threshold, the system removes the threshold from all visualizations that include the threshold.

1. To add a threshold:

   a. Edit the panel to which you want to add a threshold.

   b. In the options side pane, locate the **Thresholds** section and click **+ Add threshold**.

   c. Select a threshold color, number, and mode.
   Threshold mode applies to all thresholds on this panel.

   d. For a time-series panel, select a **Show thresholds** option.

1. To delete a threshold, navigate to the panel that contains the threshold and click the trash icon next to the threshold you want to remove.

## Add a threshold to a legacy graph panel

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
   - **Fill -** Controls whether the threshold fill is displayed.
   - **Line -** Controls whether the threshold line is displayed.
   - **Y-Axis -** Choose **left** or **right**.
1. Click **Save** to save the changes in the dashboard.
