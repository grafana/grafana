+++
title = "Stat panel"
description = "Stat panel documentation"
keywords = ["grafana", "docs", "stat panel"]
type = "docs"
aliases =["/docs/grafana/latest/features/panels/stat/"]
weight = 200
draft = "true"
+++

# Stat panel

The Stat panel shows a one large stat value with an optional graph sparkline. You can control the background or value color using thresholds.

{{< docs-imagebox img="/img/docs/v66/stat_panel_dark3.png" max-width="1025px" caption="Stat panel" >}}

## Data and field options
Stat visualizations allow you to apply:
- Data transformations
- Field settings
- Field overrides
- [Thresholds]({{< relref "../thresholds.md">}})
- Value mappings

## Automatic layout adjustment

The panel automatically adjusts the layout depending on available width and height in the dashboard. It automatically hides the graph (sparkline) if the panel becomes too small.

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
- **Color mode**
  - **Value -** Colors only the value and graph area.
  - **Background -** Colors the background as well.
- **Graph mode**
  - **None -** Hides the graph and only shows the value.
  - **Area -** Shows the area graph below the value. This requires that your query returns a time column.
- **Alignment mode -** Choose an alignment mode.
  - **Auto -** If only a single value is shown (no repeat), then the value is centered. If multiple series or rows are shown, then the value is left-aligned.
  - **Center -** Stat value is centered.
