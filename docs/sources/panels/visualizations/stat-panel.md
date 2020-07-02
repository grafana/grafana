+++
title = "Stat panel"
description = "Stat panel documentation"
keywords = ["grafana", "docs", "stat panel"]
type = "docs"
aliases = ["/docs/grafana/latest/features/panels/stat/", "/docs/grafana/latest/features/panels/singlestat/", "/docs/grafana/latest/reference/singlestat/"]
weight = 900
+++

# Stat panel

The Stat panel shows a one large stat value with an optional graph sparkline. You can control the background or value color using thresholds.

{{< docs-imagebox img="/img/docs/v66/stat_panel_dark3.png" max-width="1025px" caption="Stat panel" >}}

> **Note:** This panel replaces the Singlestat panel, which was deprecated in Grafana 7.0.

## Data and field options

Stat visualizations allow you to apply:

- [Data transformations]({{< relref "../transformations.md" >}})
- [Field configuration options and overrides]({{< relref "../field-configuration-options.md" >}})
- [Thresholds]({{< relref "../thresholds.md" >}})

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
- **Text mode** (Only available in Grafana 7.1+.)
  - **Auto -** If the data contains multiple series or fields, show both name and value..
  - **Value -** Show only value, never name. Name is displayed in the hover tooltip instead.
  - **Value and name -** Always show value and name.
  - **Name -** Show name instead of value. Value is displayed in the hover tooltip.
  - **None -** Show nothing (empty). Name and value are displayed in the hover tooltip.

## Text mode

> Only available in Grafana 7.1+.

By default, the Stat panel displays:

- Just the value for a single series or field.
- Both the value and name for multiple series or fields.

You can use the Text mode option to control what text the panel renders. If the value is not important, only name and color is, then change the `Text mode` to **Name**. The value will still be used to determine color and is displayed in a tooltip.

Example screenshot:

{{< docs-imagebox img="/img/docs/v71/stat-panel-text-modes.png" max-width="1025px" caption="Stat panel" >}}
