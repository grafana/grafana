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
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/create-dashboard-url-variables/
  dashboard:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/create-dashboard/
---

# Dashboard list

Dashboard lists allow you to display dynamic links to other dashboards. You can configure the list to use starred dashboards, recently viewed dashboards, a search query, and dashboard tags.

{{< figure src="/static/img/docs/v45/dashboard-list-panels.png" max-width="850px" alt="A dashboard list visualization" >}}

On each dashboard load, this panel queries the dashboard list, always providing the most up-to-date results.

You can use a dashboard list visualization to display a list of important dashboards that you want to track.

## Configure a dashboard list visualization

Once you’ve created a [dashboard](ref:dashboard), the following video shows you how to configure a dashboard list visualization:

{{< youtube id="MserjWGWsh8" >}}

{{< docs/play title="Dashboard List Visualization" url="https://play.grafana.org/d/fdlojrg7daebka/" >}}

## Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Dashboard list options

Use the following options to refine your dashboard list visualization.

### Include current time range

Select this option to propagate the time range of the current dashboard to the dashboard links. When you click a link, the linked dashboard opens with the indicated time range already set.

### Include current template variable values

Select this option to include template variables that are being used as query parameters in a link. When you click the link, any matching templates in the linked dashboard are set to the values from the link. Learn more in [Dashboard URL variables](ref:dashboard-url-variables).

### Starred

Display starred dashboards in alphabetical order.

### Recently viewed

Display recently viewed dashboards in alphabetical order.

### Search

Display dashboards by search query or tags. You must enter at least one value in **Query** or **Tags**. For the **Query** and **Tags** fields, variable interpolation is supported. For example, `$my_var` or `${my_var}`. Learn more in [Search option](#search-options).

### Show headings

The selected list section is shown as a heading:

- **Starred**
- **Recently viewed**
- **Search**

### Max items

Sets the maximum number of items to list per section. For example, if you leave this at the default value of 10 and select **Starred** and **Recently viewed** dashboards, then the panel displays up to 20 total dashboards, 10 in each section.

## Search options

These options only apply if you select the **Search** option.

### Query

Use this field to search by dashboard name. Query terms are case-insensitive and partial values are accepted. For example, if you have dashboards called "Indoor Temps" and "Outdoor temp", entering the word "temp" would return both results.

### Folder

Select the dashboard folders that you want to display.

### Tags

Enter tags by which you want to search. Note that tags don't appear as you type, and they're case sensitive. Tag search uses an `OR` condition, so if a dashboard has one of the defined tags, it's included in the list.

{{< admonition type="note" >}}
When multiple tags and strings appear, the dashboard list displays those matching _all_ conditions.
{{< /admonition >}}
