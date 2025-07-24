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

![A state timeline visualization showing CPU usage](/media/docs/grafana/panels-visualizations/screenshot-state-timeline-v11.4.png)

The state timeline visualization is useful when you need to monitor and analyze changes in states or statuses of various entities over time. You can use one when you need to:

- Monitor the status of a server, application, or service to know when your infrastructure is experiencing issues over time.
- Identify operational trends over time.
- Spot any recurring issues with the health of your applications.

## Configure a state timeline

{{< youtube id="a9wZHM0mdxo" >}}

{{< docs/play title="Grafana State Timeline & Status History" url="https://play.grafana.org/d/qD-rVv6Mz/6-state-timeline-and-status-history?orgId=1s" >}}

## Supported data formats

The state timeline visualization works best if you have data capturing the various states of entities over time, formatted as a table. The data must include:

- **Timestamps** - Indicate when each state change occurred. This could also be the start time for the state change. You can also add an optional timestamp to indicate the end time for the state change.
- **Entity name/identifier** - Represents the name of the entity you're trying to monitor.
- **State value** - Represents the state value of the entity you're monitoring. These can be string, numerical, or boolean states.

Each state ends when the next state begins or when there is a `null` value.

### Example 1

The following example has a single time column and includes null values:

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

The data is converted as follows, with the [null and empty values visualized as gaps](#connect-null-values) in the state timeline:

{{< figure src="/static/img/docs/state-timeline-panel/state-timeline-with-null-values.png" max-width="1025px" alt="A state timeline visualization with null values showing the status of two servers" >}}

### Example 2

The following example has two time columns and doesn't include any null values:

| Start time          | End time            | Server A | Server B |
| ------------------- | ------------------- | -------- | -------- |
| 2024-02-29 8:00:00  | 2024-02-29 8:15:00  | Up       | Up       |
| 2024-02-29 8:15:00  | 2024-02-29 8:30:00  | Up       | Up       |
| 2024-02-29 8:45:00  | 2024-02-29 9:00:00  | Down     | Up       |
| 2024-02-29 9:00:00  | 2024-02-29 9:15:00  | Down     | Up       |
| 2024-02-29 9:30:00  | 2024-02-29 10:00:00 | Down     | Down     |
| 2024-02-29 10:00:00 | 2024-02-29 10:30:00 | Warning  | Down     |

The data is converted as follows:

{{< figure src="/static/img/docs/state-timeline-panel/state-timeline-with-two-timestamps.png" max-width="1025px" alt="A state timeline visualization with two time columns showing the status of two servers" >}}

If your query results aren't in a table format like the preceding examples, especially for time-series data, you can apply specific [transformations](https://stackoverflow.com/questions/68887416/grafana-state-timeline-panel-with-values-states-supplied-by-label) to achieve this.

### Time series data

You can also create a state timeline visualization using time series data. To do this, add [thresholds](#thresholds), which turn the time series into discrete colored state regions.

![State timeline with time series](/media/docs/grafana/panels-visualizations/screenshot-state-timeline-time-series-v11.4.png)

## Configuration options

{{< docs/shared lookup="visualizations/config-options-intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### State timeline options

Use these options to refine the visualization.

<!-- prettier-ignore-start -->

| Option | Description                                                                                     |
| ------ | ----------------------------------------------------------------------------------------------- |
| Merge equal consecutive values  | Controls whether Grafana merges identical values if they are next to each other. |
| Show values  | Controls whether values are rendered inside the state regions. Choose from **Auto**, **Always**, and **Never**. **Auto** renders values if there is sufficient space. |
| Align values | Controls value alignment inside state regions. Choose from **Left**, **Center**, and **Right**. |
| Row height | Controls how much space between rows there are. 1 = no space = 0.5 = 50% space. |
| [Page size](#page-size-enable-pagination) | The **Page size** option lets you paginate the state timeline visualization to limit how many series are visible at once.  |
| Line width | Controls line width of state regions. |
| Fill opacity | Controls value alignment inside state regions. |
| [Connect null values](#connect-null-values) | Choose how null values, which are gaps in the data, appear on the graph. |
| [Disconnect null values](#disconnect-values) | Choose whether to set a threshold above which values in the data should be disconnected. |

<!-- prettier-ignore-end -->

#### Page size (enable pagination)

The **Page size** option lets you paginate the state timeline visualization to limit how many series are visible at once. This is useful when you have many series. With paginated results, the visualization displays a subset of all series on each page:

{{< video-embed src="/media/docs/grafana/panels-visualizations/screen-recording-grafana-11-2-state-timeline-pagination-dark.mp4" >}}

{{< docs/shared lookup="visualizations/connect-null-values.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="visualizations/disconnect-values.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

### Legend options

{{< docs/shared lookup="visualizations/legend-options-2.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

### Tooltip options

{{< docs/shared lookup="visualizations/tooltip-options-3.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

### Axis options

{{< docs/shared lookup="visualizations/axis-options-3.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

### Standard options

{{< docs/shared lookup="visualizations/standard-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Data links and actions

{{< docs/shared lookup="visualizations/datalink-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
