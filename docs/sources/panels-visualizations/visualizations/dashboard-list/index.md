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

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-dashboard-list-v11.6.png" max-width="750px" alt="A dashboard list visualization" >}}

On each dashboard load, this panel queries the dashboard list, always providing the most up-to-date results.

You can use a dashboard list visualization to display a list of important dashboards that you want to track.

## Configure a dashboard list visualization

Once you’ve created a [dashboard](ref:dashboard), the following video shows you how to configure a dashboard list visualization:

{{< youtube id="MserjWGWsh8" >}}

{{< docs/play title="Dashboard List Visualization" url="https://play.grafana.org/d/fdlojrg7daebka/" >}}

## Configuration options

{{< docs/shared lookup="visualizations/config-options-intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Dashboard list options

Use the following options to refine your dashboard list visualization.

<!-- prettier-ignore-start -->

| Option | Description |
| ------ | ----------- |
| Include current time range | Propagate the time range of the current dashboard to the dashboard list links. When you click a link, the linked dashboard opens with the indicated time range already set. |
| Include current template variable values | Include template variables that are being used as query parameters in the dashboard list link. When you click the link, any matching templates in the linked dashboard are set to the values from the link. Learn more in [Dashboard URL variables](ref:dashboard-url-variables). |
| Starred | Display starred dashboards in alphabetical order. |
| Recently viewed | Display recently viewed dashboards in alphabetical order. |
| Search | Display dashboards returned by search. You must enter at least one value in the search fields, **Query** or **Tags**. Variable interpolation is supported for both fields. For example, `$my_var` or `${my_var}`. |
| Show headings | Headings for enabled sections are displayed. Sections are:<ul><li>**Starred**</li><li>**Recently viewed**</li><li>**Search**</li> |
| Show folder names | Display the name of the folder where the dashboard is located. |
| Max items | Set the maximum number of items to list per section. If you enter "10" and enable **Starred** and **Recently viewed** dashboards, the panel displays up to 20 total dashboards, 10 in each section. |
| [Query](#query) | Search by dashboard name. This option is only applied when the **Search** switch is toggled on. |
| [Folder](#folder) | Only dashboards from the selected folder are displayed in the dashboard list. This option is only applied when the **Search** switch is toggled on. |
| [Tags](#tags) | Search by tags. This option is only applied when the **Search** switch is toggled on.  |

<!-- prettier-ignore-end -->

#### Query

Use this field to search by dashboard name. Query terms are case-insensitive and partial values are accepted.
For example, if you have dashboards called "Indoor Temps" and "Outdoor temp", entering the word "temp" returns both results.
This option is only applied when the **Search** switch is toggled on.

#### Folder

Only dashboards from the selected folder are included in search results and displayed in the dashboard list.
To include all dashboards in search results, select the top-level **Dashboards** folder.
This option is only applied when the **Search** switch is toggled on.

#### Tags

Enter tags by which you want to search. Note that tags don't appear as you type, and they're case sensitive.
Tag search uses an `OR` condition, so if a dashboard has one of the defined tags, it's included in the list.

When multiple tags and strings appear, the dashboard list displays those matching _all_ conditions.

This option is only applied when the **Search** switch is toggled on.
