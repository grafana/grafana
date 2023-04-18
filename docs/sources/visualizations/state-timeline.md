---
aliases:
  - ../panels/visualizations/state-timeline/
description: State timeline visualization
keywords:
  - grafana
  - docs
  - state timeline
  - panel
title: State timeline
weight: 900
---

# State timeline

The state timeline panel visualization shows discrete state changes over time. Each field or series is rendered as its unique horizontal band. State regions can either be rendered with or without values. This panel works well with string or boolean states but can also be used with time series. When used with time series, the thresholds are used to turn the numerical values into discrete state regions.

{{< figure src="/static/img/docs/v8/state_timeline_strings.png" max-width="1025px" caption="state timeline with string states" >}}

## State timeline options

Use these options to refine the visualization.

### Merge equal consecutive values

Controls whether Grafana merges identical values if they are next to each other.

### Show values

Controls whether values are rendered inside the state regions. Auto will render values if there is sufficient space.

### Align values

Controls value alignment inside state regions.

### Row height

Controls how much space between rows there are. 1 = no space = 0.5 = 50% space.

### Line width

Controls line width of state regions.

### Fill opacity

Controls the opacity of state regions.

## Value mappings

To assign colors to boolean or string values, use [Value mappings]({{< relref "../panels/format-data/about-value-mapping.md" >}}).

{{< figure src="/static/img/docs/v8/value_mappings_side_editor.png" max-width="300px" caption="Value mappings side editor" >}}

## Time series data with thresholds

The panel can be used with time series data as well. In this case, the thresholds are used to turn the time series into discrete colored state regions.

{{< figure src="/static/img/docs/v8/state_timeline_time_series.png" max-width="1025px" caption="state timeline with time series" >}}

## Legend options

When the legend option is enabled it can show either the value mappings or the threshold brackets. To show the value mappings in the legend, it's important that the `Color scheme` as referenced in [Apply color to a series and fields]({{< relref "../panels/working-with-panels/apply-color-to-series.md" >}}) is set to `Single color` or `Classic palette`. To see the threshold brackets in the legend set the `Color scheme` to `From thresholds`.

{{< docs/shared "visualizations/legend-mode.md" >}}
