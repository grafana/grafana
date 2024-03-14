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

A state timeline visualization displays data in a way that shows state changes over time. In a state timeline, the data is presented as a series of bars or bands called _state regions_. State regions can be rendered with or without values, and the region length indicates the duration or frequency of a state within a given time range.

For example, if you're monitoring the CPU usage of a server, you can use a state timeline to visualize the different states, such as “LOW,” “NORMAL,” “HIGH,” or “CRITICAL,” over time. Each state is represented by a different color and the lengths represent the duration of time that the server remained in that state:

{{< figure src="/static/img/docs/state-timeline-panel/state-timeline-panel.png" max-width="1025px" alt="A state timeline panel showing CPU usage" >}}

The state timeline visualization is useful when you need to monitor and analyze changes in states or statuses of various entities over time. You can use one when you need to:

- Monitor the status of a server, application, or service to know when your infrastructure is experiencing issues over time.
- Identify operational trends over time.
- Spot any recurring issues with the health of your applications.

## Configure a state timeline

<!-- video TBA here -->

## Supported data formats

The state timeline panel works best if you have data capturing the various states of entities over time, formatted as a table. The data must include:

- **Timestamps** - Indicate when each state change occurred. This could also be the start time for the state change. You can also add an optional timestamp to indicate the end time for the state change.
- **Entity name/identifier** - Represents the name of the entity you're trying to monitor.
- **State value** - Represents the state value of the entity you're monitoring. These can be string, numerical, or boolean states.

Each state ends when the next state begins or when there is a `null` value.

### Examples

The following tables are examples of the type of data you need for a state timeline visualization and how it should be formatted.

#### Single time column with null values

| Timestamps          | Server A | Server B |
| ------------------- | -------- | -------- |
| 2024-02-29 8:00:00  | Up       | Up       |
| 2024-02-29 8:15:00  | null     | Up       |
| 2024-02-29 8:30:00  | Down     | null     |
| 2024-02-29 8:45:00  |          | Up       |
| 2024-02-29 9:00:00  | Up       |          |
| 2024-02-29 9:15:00  | Up       | Down     |
| 2024-02-29 9:30:00  | Up       | Down     |
| 2024-02-29 10:00:00 | Down     | Down     |
| 2024-02-29 10:30:00 | Warning  | Down     |

The data is converted as follows, with the [null and empty values visualized as gaps](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/state-timeline/#connect-null-values) in the state timeline:

{{< figure src="/static/img/docs/state-timeline-panel/state-timeline-with-null-values.png" max-width="1025px" alt="A state timeline panel with null values showing the status of two servers" >}}

#### Two time columns without null values

| Start time          | End time            | Server A | Server B |
| ------------------- | ------------------- | -------- | -------- |
| 2024-02-29 8:00:00  | 2024-02-29 8:15:00  | Up       | Up       |
| 2024-02-29 8:15:00  | 2024-02-29 8:30:00  | Up       | Up       |
| 2024-02-29 8:45:00  | 2024-02-29 9:00:00  | Down     | Up       |
| 2024-02-29 9:00:00  | 2024-02-29 9:15:00  | Down     | Up       |
| 2024-02-29 9:30:00  | 2024-02-29 10:00:00 | Down     | Down     |
| 2024-02-29 10:00:00 | 2024-02-29 10:30:00 | Warning  | Down     |

The data is converted as follows:

{{< figure src="/static/img/docs/state-timeline-panel/state-timeline-with-two-timestamps.png" max-width="1025px" alt="A state timeline panel with two time columns showing the status of two servers" >}}

If your query results aren't in a table format like the preceding examples, especially for time-series data, you can apply specific [transformations](https://stackoverflow.com/questions/68887416/grafana-state-timeline-panel-with-values-states-supplied-by-label) to achieve this.

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
