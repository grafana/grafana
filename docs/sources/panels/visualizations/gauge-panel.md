+++
title = "Gauge panel"
description = "Gauge panel docs"
keywords = ["grafana", "gauge", "gauge panel"]
type = "docs"
aliases = ["/docs/grafana/latest/features/panels/gauge/"]
weight = 300
draft = "true"
+++

# Gauge panel

Gauge is a single value panel that can repeat a gauge for every series, column or row.

{{< docs-imagebox img="/img/docs/v66/gauge_panel_cover.png" max-width="1025px" >}}

## Data and field options

Gauge visualizations allow you to apply:
- Data transformations
- Field settings
- Field overrides
- [Thresholds]({{< relref "../thresholds.md">}})
- Value mappings

## Display options

Use the following options to refine your visualization:

- **Show -** Choose how Grafana displays your data.
  - **Calculate -** Show a calculated value based on all rows.
  - **All values -** Show a separate stat for every row. If you select this option, then you can also select a **Limit**, or the maximum number of rows to display.
- **Value -** Select a reducer function that Grafana will use to reduce many fields to a single value. Click the **Value** list to see functions and brief descriptions.
- **Orientation -** Choose a stacking direction.
  - **Auto -** Grafana selects what it thinks is the best orientation.
  - **Horizontal -** Bars stretch horizontally, left to right.
  - **Vertical -** Bars stretch vertically, top to bottom.
- **Show threshold labels -** Controls if threshold values are shown.
- **Show threshold markers -** Controls if a thresholds band is shown outside the inner gauge value band.
