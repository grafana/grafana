---
aliases:
  - ../../features/panels/bar_gauge/
  - ../../panels/visualizations/bar-gauge-panel/
  - ../../visualizations/bar-gauge-panel/
description: Bar gauge panel options
keywords:
  - grafana
  - bar
  - bar gauge
title: Bar gauge
weight: 200
---

# Bar gauge

The bar gauge simplifies your data by reducing every field to a single value. You choose how Grafana calculates the reduction.

This panel can show one or more bar gauges depending on how many series, rows, or columns your query returns.

{{< figure src="/static/img/docs/v66/bar_gauge_cover.png" max-width="1025px" caption="Stat panel" >}}

## Value options

Use the following options to refine how your visualization displays the value:

### Show

Choose how Grafana displays your data.

#### Calculate

Show a calculated value based on all rows.

- **Calculation -** Select a reducer function that Grafana will use to reduce many fields to a single value. For a list of available calculations, refer to [Calculation types]({{< relref "../../calculation-types/" >}}).
- **Fields -** Select the fields display in the panel.

#### All values

Show a separate stat for every row. If you select this option, then you can also limit the number of rows to display.

- **Limit -** The maximum number of rows to display. Default is 5,000.
- **Fields -** Select the fields display in the panel.

## Bar gauge options

Adjust how the bar gauge is displayed.

### Orientation

Choose a stacking direction.

- **Auto -** Grafana selects what it thinks is the best orientation.
- **Horizontal -** Bars stretch horizontally, left to right.
- **Vertical -** Bars stretch vertically, bottom to top.

### Display mode

Choose a display mode.

- **Gradient -** Threshold levels define a gradient.
- **Retro LCD -** The gauge is split into small cells that are lit or unlit.
- **Basic -** Single color based on the matching threshold.

### Show unfilled area

Select this if you want to render the unfilled region of the bars as dark gray. Not applicable to Retro LCD display mode.

### Min width

Limit the minimum width of the bar column in the vertical direction.

Automatically show x-axis scrollbar when there is a large amount of data.

### Min height

Limit the minimum height of the bar row in the horizontal direction.

Automatically show y-axis scrollbar when there is a large amount of data.
