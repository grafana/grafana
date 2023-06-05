---
aliases:
  - ../../panels/working-with-panels/configure-legend/
  - ../../visualizations/configure-legend/
title: Configure a legend
weight: 1300
---

# Configure a legend

A panel includes a legend that you can use to interpret data displayed in a visualization. Each legend option adds context and clarity to the data illustrated in a visualization.

## Isolate series data in a visualization

Visualizations can often be visually complex, and include many data series. You can simplify the view by removing series data from the visualization, which isolates the data you want to see. Grafana automatically creates a new override in the **Override** tab.

When you apply your changes, the visualization changes appear to all users of the panel.

1. Open the panel.

1. In the legend, click the label of the series you want to isolate.

   The system removes from view all other series data.

1. To incrementally add series data to an isolated series, press the **Ctrl** or **Command** key and click the label of the series you want to add.

1. To revert back to the default view that includes all data, click any series label twice.

1. To save your changes so that they appear to all viewers of the panel, click **Apply**.

This topic currently applies to the following visualizations:

- [Bar chart]({{< relref "../bar-chart/" >}})
- [Histogram]({{< relref "../histogram/" >}})
- [Pie chart]({{< relref "../pie-chart/" >}})
- [State timeline]({{< relref "../state-timeline/" >}})
- [Status history]({{< relref "../status-history/" >}})
- [Time series]({{< relref "../time-series/" >}})

## Add values to a legend

As way to add more context to a visualization, you can add series data values to a legend. You can add as many values as you'd like; after you apply your changes, you can horizontally scroll the legend to see all values.

1. Edit a panel.

1. In the panel display options pane, locate the **Legend** section.

1. In the **Legend values** field, select the values you want to appear in the legend.

1. Click **Apply** to save your changes are navigate back to the dashboard.

![Toggle series visibility](/static/img/docs/legend/legend-series-toggle-7-5.png)

## Change a series color

By default, Grafana specifies the color of your series data, which you can change.

1. Edit a panel.

1. In the legend, click the color bar associated with the series.

1. Select a pre-set color or a custom color from the color palette.

1. Click **Apply** to save your changes are navigate back to the dashboard.

![Change legend series color](/static/img/docs/legend/legend-series-color-7-5.png)

## Sort series

You can change legend mode to **Table** and choose [calculations]({{< relref "../../calculation-types/" >}}) to be displayed in the legend. Click the calculation name header in the legend table to sort the values in the table in ascending or descending order.

The sort order affects the positions of the bars in the Bar chart panel as well as the order of stacked series in the Time series and Bar chart panels.

> **Note:** This feature is only supported in these panels: Bar chart, Histogram, Time series, XY Chart.

![Sort legend series](/static/img/docs/legend/legend-series-sort-8-3.png).
