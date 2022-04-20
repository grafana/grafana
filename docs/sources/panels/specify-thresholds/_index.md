+++
title = "Configure thresholds"
aliases = ["/docs/grafana/next/panels/thresholds/", "/docs/grafana/next/panels/"]
weight = 300
+++

# Configure thresholds

This sectionUse thresholds to set the color of a visualization text and background.

## About thresholds

Thresholds set the color of either the value text or the background based on conditions that you define.

There are two types of thresholds:

- **Absolute** thresholds are defined based on a number. For example, 80 on a scale of 1 to 150.
- **Percentage** thresholds are defined relative to minimum or maximum. For example, 80 percent.

You can apply thresholds to most, but not all, visualizations.

### Default thresholds

On visualizations that support it, Grafana sets default threshold values of:

- 80 = red
- Base = green
- Mode = Absolute

The **Base** value represents minus infinity. It is generally the “good” color.

## Add a threshold

You can add as many thresholds to a panel as you want. Grafana automatically sorts thresholds from highest value to lowest.

### Before you begin

- [Add a panel to a dashboard]({{< relref "../working-with-panels/add-panel.md" >}}).

**To add a threshold**:

1. Edit the panel to which you want to add a threshold.
1. On the panel display options, locate the **Thresholds** section.
1. Click **+ Add threshold**.

   Grafana adds a threshold value and color.

1. Accept the recommendations or edit the threshold.
   - **Edit color:** To select a color, click the color dot.
   - **Edit number:** To change the threshold value, click in the field and enter a number.
1. Select a **Threshold mode**.
   Threshold mode applies to all thresholds on this panel.
1. In the **Show thresholds** drop-down, select a threshold display option.
1. Click **Save**.

## Delete a threshold

Delete a threshold when it is no longer relevant to your business operations. When you delete a threshold, the system removes the threshold from all visualizations that include the threshold.

### Before you begin

- [Add a threshold]({{< relref "./add-a-threshold.md" >}}).

**To delete a threshold**:

1. Navigate to the panel to which you want to add a threshold.
1. Click the **Field** tab. (Or **Panel** tab for a graph panel.)
1. Click the trash can icon next to the threshold you want to remove.
1. Click **Save** to save the changes in the dashboard.

## Add a threshold to a legacy graph panel

In the Graph panel visualization, thresholds enable you to add lines or sections to a graph to make it easier to recognize when the graph crosses a threshold.

### Before you begin

- [Add a panel to a dashboard]({{< relref "../working-with-panels/add-panel.md" >}}).

**To add a threshold to a graph panel**:

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
