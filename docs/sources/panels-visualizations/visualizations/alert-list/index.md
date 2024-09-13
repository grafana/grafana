---
aliases:
  - ../../features/panels/alertlist/
  - ../../panels/visualizations/alert-list-panel/
  - ../../reference/alertlist/
  - ../../visualizations/alert-list-panel/
keywords:
  - grafana
  - alert list
  - documentation
  - panel
  - alertlist
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Alert list
description: Configure options for Grafana's alert list visualization
weight: 100
refs:
  grafana-alerting-overview:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/
---

# Alert list

Alert lists allow you to display a list of important alerts that you want to track. You can configure the alert list to show the current state of your alert, such as firing, pending, or normal. Learn more about alerts in [Grafana Alerting overview](ref:grafana-alerting-overview).

{{< figure src="/static/img/docs/alert-list-panel/alert-list-panel.png" max-width="850px" alt="An alert list visualization" >}}

On each dashboard load, this visualization queries the alert list, always providing the most up-to-date results.

{{< docs/play title="Alert List" url="https://play.grafana.org/d/bdodlcyou483ke/" >}}

## Configure an alert list

Once you’ve created a [dashboard](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard/), the following video shows you how to configure an alert list visualization:

{{< youtube id="o4rK7_AXZ9Y" >}}

## Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Options

Use the following options to refine your alert list visualization.

### View mode

Choose between **List** to display alerts in a detailed list format with comprehensive information, or **Stat** to show alerts as a summarized single-value statistic.

### Group mode

Choose between **Default grouping** to show alert instances grouped by their alert rule, or **Custom grouping** to show alert instances grouped by a custom set of labels.

### Max items

Sets the maximum number of alerts to list. By default, Grafana sets this value to 10.

### Sort order

Select how to order the alerts displayed. Choose from:

- **Alphabetical (asc) -** Alphabetical order.
- **Alphabetical (desc) -** Reverse alphabetical order.
- **Importance -** By importance according to the following values, with 1 being the highest:
  - alerting: 1
  - firing: 1
  - no_data: 2
  - pending: 3
  - ok: 4
  - paused: 5
  - inactive: 5
- **Time (asc) -** Newest active alert instances first.
- **Time (desc) -** Oldest active alert instances first.

### Alerts linked to this dashboard

Toggle the switch on to only show alerts from the dashboard the alert list is in.

## Filter

These options allow you to limit alerts shown to only those that match the query, folder, or tags you choose.

### Alert name

Filter alerts by name.

### Alert instance label

Filter alert instances using [label](https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/annotation-label/) querying. For example,`{severity="critical", instance=~"cluster-us-.+"}`.

### Datasource

Filter alerts from the selected data source.

### Folder

Filter alerts by the selected folder. Only alerts from dashboards in this folder are displayed.

## Alert state filter

Choose which alert states to display in this visualization.

- **Alerting / Firing -** Shows alerts that are currently active and triggering an alert condition.
- **Pending -** Shows alerts that are in a transitional state, waiting for conditions to be met before triggering.
- **No Data -** Shows alerts where the data source is not returning any data, which could indicate an issue with data collection.
- **Normal -** Shows alerts that are in a normal or resolved state, where no alert condition is currently met.
- **Error -** Shows alerts where an error has occurred, typically related to an issue in the alerting process.
