---
aliases:
  - /docs/grafana/latest/dashboards/dashboard-ui/
  - /docs/grafana/latest/dashboards/dashboard-ui/dashboard-header/
  - /docs/grafana/latest/features/dashboard/dashboards/
  - /docs/grafana/latest/dashboards/dashboard-ui/dashboard-row/
  - /docs/grafana/latest/features/dashboard/dashboards/
  - /docs/grafana/latest/dashboards/shortcuts/
  - /docs/grafana/latest/dashboards/search/
  - /docs/grafana/latest/reference/search/
title: 'Use dashboards'
menuTitle: Use dashboards
weight: 2
keywords:
  - dashboard
  - search
  - shortcuts
---

# Use dashboards

The dashboard UI has the following sections to allow you to customize the presentation of data.

{{< figure src="/static/img/docs/v50/dashboard_annotated.png" class="no-shadow" width="700px" >}}

- **Zoom out time range** (1)
- **Time picker dropdown** (2). Access relative time range options, auto refresh options and set custom absolute time ranges.
- **Manual refresh option** (3) Fetch new data.
- **Dashboard panel** (4) Click the panel title to edit panels.
- **Graph legend** (5) Change series colors, y-axis and series visibility directly from the legend.

For more details, see [Dashboard header]({{< relref "#dashboard-header" >}}) and [Dashboard rows]({{< relref "#dashboard-rows" >}}).

## Dashboard header

The dashboard header has the following sections.

{{< figure src="/static/img/docs/v50/top_nav_annotated.png" width="450px" >}}

- **Side menubar toggle** (1): This option toggles the side menu. It provides access to features unrelated to a dashboard such as users, organizations, data sources, and alerting.
- **Dashboard dropdown** (2): Use this option to view the current dashboard name. From here, you can:
  - Select another dashboard name to easily switch to that dashboard.
  - Create a new dashboard or folder, import existing dashboards, and manage dashboard playlists.
- **Add panel** (3): Use this option to add a new panel to the current dashboard.
- **Star dashboard** (4): Use this option to star (or unstar) the current dashboard. Starred dashboards show up on your own home dashboard by default. It is a convenient way to mark Dashboards that you're interested in.
- **Share dashboard** (5): Use this option to share the current dashboard by creating a link or create a static snapshot of it. You must save the dashboard before sharing.
- **Save dashboard** (6): Use this option to save the current dashboard using its current name.
- **Settings** (7): Use this option to manage dashboard settings and configure templates and annotations.

## Dashboard rows

A dashboard row is a logical divider within a dashboard. It is used to group panels together.

Grafana uses a base unit abstraction so that dashboards and panels look great on all screen sizes. Dashboard rows are always 12 “units” wide. These units are automatically scaled dependent on the horizontal resolution of your browser. You can control the relative width of panels within a row by setting their specific width.

> **Note:** With MaxDataPoint functionality, Grafana can show you the perfect number of data points, regardless of resolution or time range.

### Create or remove rows

Use the [repeating rows]({{< relref "../panels/add-panels-dynamically/configure-repeating-rows" >}}) functionality to dynamically create or remove entire rows, which can be filled with panels, based on the template variables selected.

### Collapse rows

Collapse a row by clicking on the row title. If you save a dashboard with a row collapsed, then it saves in that state and does not load those graphs until you expand the row.

## Keyboard shortcuts

Grafana has a number of keyboard shortcuts available. Press `?` or `h` on your keyboard to display all keyboard shortcuts available in your version of Grafana.

- Ctrl+S saves the current dashboard.
- Ctrl+F opens the dashboard finder / search.
- Ctrl+H hides all controls (good for tv displays).
- Ctrl+K opens the command palette.
- Press Escape to exit graph when in fullscreen or edit mode.

## Dashboard Search

Dashboards can be searched by the dashboard name, filtered by one (or many) tags or filtered by starred status. The dashboard search is accessed through the dashboard picker, available in the dashboard top nav area. The dashboard search can also be opened by using the shortcut `F`.

{{< figure src="/static/img/docs/v50/dashboard_search_annotated.png" width="700px" >}}

1. `Search Bar`: The search bar allows you to enter any string and search both database and file based dashboards in real-time.
1. `Starred`: Here you find all your starred dashboards.
1. `Recent`: Here you find the latest created dashboards.
1. `Folders`: The tags filter allows you to filter the list by dashboard tags.
1. `Root`: The root contains all dashboards that are not placed in a folder.
1. `Tags`: The tags filter allows you to filter the list by dashboard tags.

When using only a keyboard, you can use your keyboard arrow keys to navigate the results, hit enter to open the selected dashboard.

### Find by dashboard name

Begin typing any part of the desired dashboard names in the search bar. Search will return results for any partial string match in real-time, as you type.

Dashboard search is:

- Real-time
- _Not_ case sensitive
- Functional across stored _and_ file based dashboards.

### Filter by Tag(s)

Tags are a great way to organize your dashboards, especially as the number of dashboards grow. Tags can be added and managed in the dashboard `Settings`.

To filter the dashboard list by tag, click on any tag appearing in the right column. The list may be further filtered by clicking on additional tags:

Alternately, to see a list of all available tags, click the tags dropdown menu. All tags will be shown, and when a tag is selected, the dashboard search will be instantly filtered:

When using only a keyboard: `tab` to focus on the _tags_ link, `▼` down arrow key to find a tag and select with the `Enter` key.

> **Note:** When multiple tags are selected, Grafana will show dashboards that include **all**.
