---
aliases:
  - ../../features/panels/dashlist/
  - ../../panels/visualizations/dashboard-list-panel/
  - ../../reference/dashlist/
  - ../../visualizations/dashboard-list-panel/
keywords:
  - grafana
  - dashboard list
  - documentation
  - panel
  - dashlist
labels:
  products:
    - cloud
    - enterprise
    - oss
description: Configure options for Grafana's dashboard list visualization
title: Dashboard list
weight: 100
refs:
  dashboard-url-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard-url-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard-url-variables/
---

# Dashboard list

Dashboard lists allow you to display dynamic links to other dashboards. The list can be configured to use starred dashboards, recently viewed dashboards, a search query, and dashboard tags.

{{< figure src="/static/img/docs/v45/dashboard-list-panels.png" max-width="850px" alt="A dashboard list visualization" >}}

On each dashboard load, this panel queries the dashboard list, always providing the most up-to-date results.

You can use a dashboard list visualization to display a list of important dashboards that you want to track.

## Configure a dashboard list visualization

Once you’ve created a [dashboard](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard/), the following video shows you how to configure a dashboard list visualization:

{{< youtube id="MserjWGWsh8" >}}

{{< docs/play title="Dashboard List Visualization" url="https://play.grafana.org/d/fdlojrg7daebka/" >}}

## Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Dashboard list options

Use the following options to refine your dashboard list visualization.

### Include current time range

Select this option to propagate the time range of the current dashboard to the dashboard links. When you click a link, the linked dashboard opens with the indicated time range already set.

### Include current template variable values

Select this option to include template variables currently used as query parameters in a link. When you click the link, any matching templates in the linked dashboard are set to the values from the link. Learn more in [Dashboard URL variables](ref:dashboard-url-variables).

### Starred

Display starred dashboards in alphabetical order.

### Recently viewed

Display recently viewed dashboards in alphabetical order.

### Search

Display dashboards by search query or tags. You must enter at least one value in **Query** or **Tags**. For the **Query** and **Tags** fields, variable interpolation is supported. For example, `$my_var` or `${my_var}`.

### Show headings

The selected list section (**Starred**, **Recently viewed**, **Search**) is shown as a heading.

### Max items

Sets the maximum number of items to list per section. For example, if you leave this at the default value of 10 and select **Starred** and **Recently viewed** dashboards, then the panel displays up to 20 total dashboards, 10 in each section.

## Search options

These options only apply if the **Search** option is selected.

### Query

Enter the query by which you want to search. Queries are case-insensitive and partial values are accepted.

### Folder

Select the dashboard folders that you want to display.

### Tags

Enter tags by which you want to search. Note that existing tags don't appear as you type, and they _are_ case sensitive.

> **Note:** When multiple tags and strings appear, the dashboard list displays those matching _all_ conditions.
