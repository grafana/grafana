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
  - /docs/grafana/latest/dashboards/use-dashboards/
title: Use dashboards
menuTitle: Use dashboards
weight: 1
keywords:
  - dashboard
  - search
  - shortcuts
---

# Use dashboards

This topic provides an overview of dashboard features and shortcuts, and describes how to use dashboard search.

## Dashboard feature overview

The dashboard user interface provides a number of features that you can use to customize the presentation of your data.

The following image and descriptions highlights all dashboards features.

{{< figure src="/static/img/docs/v91/dashboard-features/dashboard-features.png" width="700px" >}}

- **Grafana home** (1): Click the Grafana home icon to be redirected to the home page configured in the Grafana instance.
- **Dashboard title** (2): When you click the dashboard title you can search for dashboard contained in the current folder.
- **Share dashboard** (3): Use this option to share the current dashboard by link or snapshot. You can also export the dashboard definition from the share modal.
- **Add panel** (4): Use this option to add a panel, dashboard row, or library panel to the current dashboard.
- **Dashboard settings** (5): Use this option to change dashboard name, folder, and tags and manage variables and annotation queries.
- **Time picker dropdown** (6): Click to select relative time range options and set custom absolute time ranges.
- **Zoom out time range** (7): Click to zoom out the time range. For more information about how to use time range controls, refer to [Common time range controls](../time-range-controls/#common-time-range-controls).
- **Refresh dashboard** (8): Click to immediately trigger queries and refresh dashboard data.
- **Refresh dashboard time interval** (9): Click to select a dashboard auto refresh time interval.
- **View mode** (10): Click to display the dashboard on a large screen such as a TV or a kiosk. View mode hides irrelevant information such as navigation menus. For more information about view mode, refer to [How to Create Kiosks to Display Dashboards on a TV](https://grafana.com/blog/2019/05/02/grafana-tutorial-how-to-create-kiosks-to-display-dashboards-on-a-tv/).
- **Dashboard panel** (11): The primary building block of a dashboard is the panel. To add a new panel, dashboard row, or library panel, click **Add panel**.
  - Library panels can be shared among many dashboards.
  - To move a panel, drag the panel header to another location.
  - To resize a panel, click and drag the lower right corner of the panel.
- **Graph legend** (12): Change series colors, y-axis and series visibility directly from the legend.
- **Search** (13): Click **Search** to search for dashboards by name or panel title.
- **Dashboard row** (14): A dashboard row is a logical divider within a dashboard that groups panels together.
  - Rows can be collapsed or expanded allowing you to hide parts of the dashboard.
  - Panels inside a collapsed row do not issue queries.
  - Use [repeating rows]({{< relref "../../configure-panels-visualizations/add-organize-panels/#configure-repeating-rows" >}}) to dynamically create rows based on a template variable.

## Keyboard shortcuts

Grafana has a number of keyboard shortcuts available. Press `?` or `h` on your keyboard to display all keyboard shortcuts available in your version of Grafana.

- `Ctrl+S`: Saves the current dashboard.
- `f`: Opens the dashboard finder / search.
- `d+k`: Toggle kiosk mode (hides the menu).
- `d+e`: Expand all rows.
- `d+s`: Dashboard settings.
- `Ctrl+K`: Opens the command palette.
- `Esc`: Exits panel when in fullscreen view or edit mode. Also returns you to the dashboard from dashboard settings.

**Focused panel**

By hovering over a panel with the mouse you can use some shortcuts that will target that panel.

- `e`: Toggle panel edit view
- `v`: Toggle panel fullscreen view
- `ps`: Open Panel Share Modal
- `pd`: Duplicate Panel
- `pr`: Remove Panel
- `pl`: Toggle panel legend
