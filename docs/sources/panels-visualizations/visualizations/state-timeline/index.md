---
aliases:
  - ../../panels/visualizations/state-timeline/
  - ../../visualizations/state-timeline/
description: Configure options for Grafana's state timeline visualization
keywords:
  - grafana
  - docs
  - state timeline
  - panel
labels:
  products:
    - cloud
    - enterprise
    - oss
title: State timeline
weight: 100
---

# State timeline

A state timeline panel displays data in a way that shows the state changes over time. When using a state timeline, the data is presented as a series of horizontal bars or bands called state regions. State regions can be rendered with or without values, and the state region’s length indicates a particular state's duration or frequency within a given time range.

As an example, if you're monitoring the CPU usage of a server, a state timeline can be used to visualize the different states over time, such as “low,” “normal,” “high,” or “critical.” Each state can be represented in different colors and lengths. The lengths represent the duration of time that the server remained in that state.

{{< figure src="/static/img/docs/state-timeline-panel/state-timeline-panel.png" max-width="1025px" caption="State timeline with string states" alt="A state timeline panel showing CPU usage in a Grafana dashboard" >}}

The state timeline panel is useful when you need to monitor and analyze changes in states or statuses of various entities over time. A state timeline panel is useful when:

- You have to monitor the status of a server, application, or service to know when your infrastructure is experiencing issues over time.
- You want to identify operational trends over time.
- You want to spot any recurring issues with the health of your applications.

## Configure a state timeline

## Supported data formats

The state timeline panel works best if you have data capturing various entities' states over time, which should include:

- Timestamps - to indicate when each state change occurred.
- Entity name/identifier - to represent the name of the entity you are trying to monitor.
- State value - to represent the state value of the entity you are monitoring. These could be string, numerical, or boolean states.

### Example

For example, the visualization works best if you have the following data in a table format.

| Timestamps         | Server A | Server B |
| ------------------ | -------- | -------- |
| 2024-02-29 8:00:00 | Up       | Up       |
| 2024-02-29 8:15:00 | Down     | Up       |
| 2024-02-29 8:30:00 | Warning  | Up       |
| 2024-02-29 8:45:00 | Up       | Up       |
| 2024-02-29 9:00:00 | Up       | Up       |

If your query isn’t in the table format above, especially time-series data, then you can always apply [transformations](https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/transform-data/) to achieve the desired result.

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

{{< docs/shared lookup="visualizations/connect-null-values.md" source="grafana" version="<GRAFANA VERSION>" >}}

{{< docs/shared lookup="visualizations/disconnect-values.md" source="grafana" version="<GRAFANA VERSION>" >}}

## Value mappings

To assign colors to boolean or string values, you can use [Value mappings][].

{{< figure src="/static/img/docs/v8/value_mappings_side_editor.png" max-width="300px" caption="Value mappings side editor" >}}

## Time series data with thresholds

The visualization can be used with time series data as well. In this case, the thresholds are used to turn the time series into discrete colored state regions.

{{< figure src="/static/img/docs/v8/state_timeline_time_series.png" max-width="1025px" caption="state timeline with time series" >}}

## Legend options

When the legend option is enabled it can show either the value mappings or the threshold brackets. To show the value mappings in the legend, it's important that the `Color scheme` as referenced in [Color scheme][] is set to `Single color` or `Classic palette`. To see the threshold brackets in the legend set the `Color scheme` to `From thresholds`.

{{< docs/shared lookup="visualizations/legend-mode.md" source="grafana" version="<GRAFANA VERSION>" >}}

{{% docs/reference %}}
[Color scheme]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/configure-standard-options#color-scheme"
[Color scheme]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/configure-standard-options#color-scheme"

[Value mappings]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/configure-value-mappings"
[Value mappings]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/configure-value-mappings"
{{% /docs/reference %}}
