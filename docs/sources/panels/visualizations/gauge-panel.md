+++
title = "Gauge panel"
description = "Gauge panel docs"
keywords = ["grafana", "gauge", "gauge panel"]
type = "docs"
aliases = ["/docs/grafana/latest/features/panels/gauge/"]
weight = 400
+++

# Gauge panel

Gauge is a single value panel that can repeat a gauge for every series, column or row.

{{< docs-imagebox img="/img/docs/v66/gauge_panel_cover.png" max-width="1025px" >}}

## Data and field options

Gauge visualizations allow you to apply:

- [Data transformations]({{< relref "../transformations/_index.md" >}})
- [Field options and overrides]({{< relref "../field-options/_index.md" >}})
- [Thresholds]({{< relref "../thresholds.md" >}})

## Display options

Use the following options to refine your visualization:

- **Show -** Choose how Grafana displays your data.
  - **Calculate -** Show a calculated **Value** based on all rows. For a list of available calculations, refer to [List of calculations]({{< relref "../calculations-list.md" >}}).
  - **All values -** Show a separate stat for every row. If you select this option, then you can also select a **Limit**, or the maximum number of rows to display.
- **Orientation -** Choose a stacking direction.
  - **Auto -** Grafana selects what it thinks is the best orientation.
  - **Horizontal -** Bars stretch horizontally, left to right.
  - **Vertical -** Bars stretch vertically, top to bottom.
- **Show threshold labels -** Controls if threshold values are shown.
- **Show threshold markers -** Controls if a threshold band is shown outside the inner gauge value band.
