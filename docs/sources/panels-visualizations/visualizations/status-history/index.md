---
aliases:
  - ../../panels/visualizations/status-history/
  - ../../visualizations/status-history/
description: Configure options for Grafana's status history visualization
keywords:
  - grafana
  - docs
  - status history
  - panel
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Status history
weight: 100
refs:
  color-scheme:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-standard-options/#color-scheme
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-standard-options/#color-scheme
  value-mappings:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-value-mappings/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-value-mappings/
---

# Status history

A status history visualization displays data in a way that shows periodic states over time. In a status history, each field or series is rendered as a horizontal row, with multiple boxes showing the different statuses. This provides you with a centralized view for the status of a component or service.

For example, if you're monitoring the health status of different services, you can use a status history to visualize the different statuses, such as “True” or "False," over time. Each status is represented by a different color:

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-status-history-v11.6.png" max-width="800px" alt="A status history panel showing the health status of different sensors" >}}

{{% admonition type="note" %}}
A status history is similar to a [state timeline](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/state-timeline/), but has different [configuration options](#status-history-options). Unlike state timelines, status histories don't merge consecutive values.
{{% /admonition %}}

Use a status history when you need to:

- Monitor the status of a server, application, or service to know when your infrastructure is experiencing issues over time.
- Identify operational trends over time.
- Spot any recurring issues with the health of your applications.

## Configure a status history

Once you've [created a dashboard](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard/), you can use the following state timeline video as a reference for how to configure a status history:

{{< youtube id="a9wZHM0mdxo" >}}

{{< docs/play title="Grafana State Timeline & Status History" url="https://play.grafana.org/d/qD-rVv6Mz/6-state-timeline-and-status-history?orgId=1s" >}}

## Supported data formats

The status history visualization works best if you have data capturing the various status of entities over time, formatted as a table. The data must include:

- **Timestamps** - Indicate when each status change occurred. This could also be the start time for the status change. You can also add an optional timestamp to indicate the end time for the status change.
- **Entity name/identifier** - Represents the name of the entity you're trying to monitor.
- **Status value** - Represents the state value of the entity you're monitoring. These can be string, numerical, or boolean states.

### Examples

The following tables are examples of the type of data you need for a status history visualization and how it should be formatted.

#### Single time column with null values

| Timestamps         | Backend_01 | Backend_02 |
| ------------------ | ---------- | ---------- |
| 2024-02-29 8:00:00 | OK         | WARN       |
| 2024-02-29 8:15:00 | WARN       |            |
| 2024-02-29 8:18:00 |            | WARN       |
| 2024-02-29 8:30:00 | BAD        |            |
| 2024-02-29 8:36:00 |            | OK         |
| 2024-02-29 8:45:00 | OK         |            |

The data is converted as follows, with the null and empty values visualized as gaps in the status history:

{{< figure src="/static/img/docs/status-history-panel/status_history_with_null.png" max-width="1025px" alt="A status history panel with null values showing the status of two servers" >}}

#### Two time columns without null values

| Start time         | End time           | Backend_01 | Backend_02 |
| ------------------ | ------------------ | ---------- | ---------- |
| 2024-02-29 8:00:00 | 2024-02-29 8:15:00 | OK         | OK         |
| 2024-02-29 8:15:00 | 2024-02-29 8:30:00 | OK         | OK         |
| 2024-02-29 8:30:00 | 2024-02-29 8:45:00 | OK         | OK         |
| 2024-02-29 8:45:00 | 2024-02-29 9:00:00 | BAD        | WARN       |
| 2024-02-29 9:00:00 | 2024-02-29 9:15:00 | OK         | WARN       |

The data is converted as follows:

{{< figure src="/static/img/docs/status-history-panel/status_history.png" max-width="1025px" alt="A status history panel with two time columns showing the status of two servers" >}}

## Configuration options

{{< docs/shared lookup="visualizations/config-options-intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Status history options

Use these options to refine the visualization.

<!-- prettier-ignore-start -->

| Option | Description                                                                                     |
| ------ | ----------------------------------------------------------------------------------------------- |
| Show values  | Controls whether values are rendered inside the state regions. Choose from **Auto**, **Always**, and **Never**. **Auto** renders values if there is sufficient space. |
| Row height  | Controls the height of boxes. 1 = maximum space and 0 = minimum space. |
| Column width | Controls the width of boxes. 1 = maximum space and 0 = minimum space. |
| Page size (enable pagination) | The **Page size** option lets you paginate the status history visualization to limit how many series are visible at once. This is useful when you have many series. |
| Line width | Controls line width of state regions. |
| Fill opacity | Controls value alignment inside state regions. |

<!-- prettier-ignore-end -->

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
