---
aliases:
  - ../features/panels/alertlist/
  - ../panels/visualizations/alert-list-panel/
  - ../reference/alertlist/
keywords:
  - grafana
  - alert list
  - documentation
  - panel
  - alertlist
title: Alert list
weight: 100
---

# Alert list

The Alert list allows you to display your dashboards alerts. You can configure the list to show current state or recent state changes. You can read more about alerts in [Alerts overview]({{< relref "../alerting/_index.md" >}}).

{{< figure src="/static/img/docs/v45/alert-list-panel.png" max-width="850px" >}}

Use these settings to refine your visualization.

## Options

- **Show -** Choose whether the panel should display the current alert state or recent alert state changes.
- **Max Items -** Sets the maximum number of alerts to list.
- **Sort order -** Select how to order the alerts displayed:
  - **Alphabetical (asc) -** Alphabetical order.
  - **Alphabetical (desc) -** Reverse alphabetical order.
  - **Importance -** By importance according to the following values, with 1 being the highest:
    - alerting: 1
    - no_data: 2
    - pending: 3
    - ok: 4
    - paused: 5
- **Alerts from this dashboard -** Shows alerts only from the dashboard the alert list is in.

## Filter

These options allow you to limit alerts shown to only those that match the query, folder, or tags you choose.

- **Alert name -** Enter an alert name query.
- **Dashboard title -** Enter a dashboard title query.
- **Folder -** Select a folder. Only alerts from dashboards in the folder selected will be displayed.
- **Dashboard tags -** Select one or more tags. Only alerts from dashboards with one or more of the tags will be displayed.

## State filter

Choose which alert states to display in this panel.

- Ok
- Paused
- No data
- Execution error
- Alerting
- Pending
