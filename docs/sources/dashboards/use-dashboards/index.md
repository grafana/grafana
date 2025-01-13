---
aliases:
  - ../reference/search/
  - dashboard-ui/
  - dashboard-ui/dashboard-header/
  - dashboard-ui/dashboard-row/
  - search/
  - shortcuts/
  - time-range-controls/
keywords:
  - dashboard
  - search
  - shortcuts
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Use dashboards
title: Use dashboards
description: Learn about the features of a Grafana dashboard
weight: 100
refs:
  dashboard-analytics:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/assess-dashboard-usage/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/assess-dashboard-usage/
  generative-ai-features:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/manage-dashboards/#set-up-generative-ai-features-for-dashboards
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/manage-dashboards/#set-up-generative-ai-features-for-dashboards
  dashboard-settings:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/modify-dashboard-settings/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/modify-dashboard-settings/
  repeating-rows:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard/#configure-repeating-rows
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/create-dashboard/#configure-repeating-rows
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/
  dashboard-folders:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/manage-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/manage-dashboards/
  sharing:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/share-dashboards-panels/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/share-dashboards-panels/
  dashboard-links:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/manage-dashboard-links/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/manage-dashboard-links/
  panel-overview:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/panel-overview/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/panel-overview/
  export-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/share-dashboards-panels/#export-dashboards
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/share-dashboards-panels/#export-dashboards
  add-ad-hoc-filters:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/add-template-variables/#add-ad-hoc-filters
  shared-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/share-dashboards-panels/shared-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/share-dashboards-panels/shared-dashboards/
---

# Use dashboards

This topic provides an overview of dashboard features and shortcuts, and describes how to use dashboard search.

{{< youtube id="vTiIkdDwT-0" >}}

## Dashboard feature overview

The dashboard user interface provides a number of features that you can use to customize the presentation of your data.

The following image and descriptions highlight all dashboard features.

![An annotated image of a dashboard](/media/docs/grafana/dashboards/screenshot-dashboard-annotated-v11.3-2.png)

1. **Dashboard folder** - When you click the dashboard folder name, you can search for other dashboards contained in the folder and perform other [folder management tasks](ref:dashboard-folders).
1. **Dashboard title** - You can create your own dashboard titles or have Grafana create them for you using [generative AI features](ref:generative-ai-features).
1. **Kiosk mode** - Click to display the dashboard on a large screen such as a TV or a kiosk. Kiosk mode hides the main menu, navbar, and dashboard controls. Learn more about kiosk mode in our [How to Create Kiosks to Display Dashboards on a TV blog post](https://grafana.com/blog/2019/05/02/grafana-tutorial-how-to-create-kiosks-to-display-dashboards-on-a-tv/). Press `Esc` to leave kiosk mode.
1. **Mark as favorite** - Mark the dashboard as one of your favorites so it's included in your list of **Starred** dashboards in the main menu.
1. **Public label** - When you [share a dashboard externally](ref:shared-dashboards), it's marked with the **Public** label.
1. **Dashboard insights** - Click to view analytics about your dashboard including information about users, activity, query counts. Learn more about [dashboard analytics](ref:dashboard-analytics).
1. **Edit** - Click to leave view-only mode and enter edit mode, where you can make changes directly to the dashboard and access dashboard settings, as well as several panel editing functions.
1. **Export** - Access [dashboard exporting](ref:export-dashboards) options.
1. **Share dashboard** - Access several [dashboard sharing](ref:sharing) options.
1. **Variables** - Use [variables](ref:variables), including ad hoc filters, to create more interactive and dynamic dashboards.
1. **Dashboard links** - Link to other dashboards, panels, and external websites. Learn more about [dashboard links](ref:dashboard-links).
1. **Current dashboard time range and time picker** - Click to select [relative time range](#relative-time-range) options and set custom [absolute time ranges](#absolute-time-range).
   - You can change the **Timezone** and **Fiscal year** settings from the time range controls by clicking the **Change time settings** button.
   - Time settings are saved on a per-dashboard basis.
1. **Time range zoom out** - Click to zoom out the time range. Learn more about how to use [common time range controls](#common-time-range-controls).
1. **Refresh dashboard** - Click to immediately trigger queries and refresh dashboard data.
1. **Auto refresh control** - Click to select a dashboard auto refresh time interval.
1. **Dashboard row** - A dashboard row is a logical divider within a dashboard that groups panels together.
   - Rows can be collapsed or expanded allowing you to hide parts of the dashboard.
   - Panels inside a collapsed row do not issue queries.
   - Use [repeating rows](ref:repeating-rows) to dynamically create rows based on a template variable.
1. **Dashboard panel** - The [panel](ref:panel-overview) is the primary building block of a dashboard.
1. **Panel legend** - Change series colors as well as y-axis and series visibility directly from the legend.

## Keyboard shortcuts

Grafana has a number of keyboard shortcuts available. Press `?` on your keyboard to display all keyboard shortcuts available in your version of Grafana.

- `Ctrl+S`: Saves the current dashboard.
- `f`: Opens the dashboard finder / search.
- `d+k`: Toggle kiosk mode (hides the menu).
- `d+e`: Expand all rows.
- `d+s`: Dashboard settings.
- `Ctrl+K`: Opens the command palette.
- `Esc`: Exits panel when in full screen view or edit mode. Also returns you to the dashboard from dashboard settings.

**Focused panel**

By hovering over a panel with the mouse you can use some shortcuts that will target that panel.

- `e`: Toggle panel edit view
- `v`: Toggle panel full screen view
- `pu`: Open share panel link configuration
- `pe`: Open share panel embed configuration
- `ps`: Open share panel snapshot configuration
- `pd`: Duplicate panel
- `pr`: Remove panel

## Set dashboard time range

Grafana provides several ways to manage the time ranges of the data being visualized, for dashboard, panels and also for alerting.

This section describes supported time units and relative ranges, the common time controls, dashboard-wide time settings, and panel-specific time settings.

### Time units and relative ranges

Grafana supports the following time units: `s (seconds)`, `m (minutes)`, `h (hours)`, `d (days)`, `w (weeks)`, `M (months)`, `Q (quarters)` and `y (years)`.

The minus operator enables you to step back in time, relative to the current date and time, or `now`. If you want to display the full period of the unit (day, week, month, etc...), append `/<time unit>` to the end. To view fiscal periods, use `fQ (fiscal quarter)` and `fy (fiscal year)` time units.

The plus operator enables you to step forward in time, relative to now. For example, you can use this feature to look at predicted data in the future.

The following table provides example relative ranges:

| Example relative range | From:       | To:         |
| ---------------------- | ----------- | ----------- |
| Last 5 minutes         | `now-5m`    | `now`       |
| The day so far         | `now/d`     | `now`       |
| This week              | `now/w`     | `now/w`     |
| This week so far       | `now/w`     | `now`       |
| This month             | `now/M`     | `now/M`     |
| This month so far      | `now/M`     | `now`       |
| Previous Month         | `now-1M/M`  | `now-1M/M`  |
| This year so far       | `now/Y`     | `now`       |
| This Year              | `now/Y`     | `now/Y`     |
| Previous fiscal year   | `now-1y/fy` | `now-1y/fy` |

{{% admonition type="note" %}}

Grafana Alerting does not support the following syntaxes at this time:

- now+n for future timestamps.
- now-1n/n for "start of n until end of n" because this is an absolute timestamp.

{{% /admonition %}}

### Common time range controls

The dashboard and panel time controls have a common UI.

![Common time controls](/media/docs/grafana/dashboards/screenshot-common-time-controls-11.2.png)

The following sections define common time range controls.

#### Current time range

The current time range, also called the _time picker_, shows the time range currently displayed in the dashboard or panel you are viewing.

Hover your cursor over the field to see the exact time stamps in the range and their source (such as the local browser).

![Time picker](/media/docs/grafana/dashboards/screenshot-time-picker-11.2.png)

Click the current time range to change it. You can change the current time using a _relative time range_, such as the last 15 minutes, or an _absolute time range_, such as `2020-05-14 00:00:00 to 2020-05-15 23:59:59`.

![Current time range](/media/docs/grafana/dashboards/screenshot-current-time-range-11.2.png)

#### Relative time range

Select the relative time range from the **Relative time ranges** list. You can filter the list using the input field at the top. Some examples of time ranges include:

- Last 30 minutes
- Last 12 hours
- Last 7 days
- Last 2 years
- Yesterday
- Day before yesterday
- This day last week
- Today so far
- This week so far
- This month so far

#### Absolute time range

You can set an absolute time range in the following ways:

- Type values into the **From** and **To** fields. You can type exact time values or relative values, such as `now-24h`, and then click **Apply time range**.
- Click in the **From** or **To** field. Grafana displays a calendar. Click the day or days you want to use as the current time range and then click **Apply time range**.

This section also displays recently used absolute ranges.

#### Semi-relative time range

{{% admonition type="note" %}}

Grafana Alerting does not support semi-relative time ranges.

{{% /admonition %}}

You can also use the absolute time range settings to set a semi-relative time range. Semi-relative time range dashboards are useful when you need to monitor the progress of something over time, but you also want to see the entire history from a starting point.

Set a semi-relative time range by setting the start time to an absolute timestamp and the end time to a “now” that is relative to the current time. For example:

**Start time:** `2023-05-01 00:00:00`

**End time:** `now`

If you wanted to track the progress of something during business hours, you could set a time range that covers the current day, but starting at 8am, like so:

**Start time:** `now/d+8h`

**End time:** `now`

This is equivalent to the **Today so far** time range preset, but it starts at 8:00am instead of 12:00am by appending +8h to the periodic start time.

Using a semi-relative time range, as time progresses, your dashboard will automatically and progressively zoom out to show more history and fewer details. At the same rate, as high data resolution decreases, historical trends over the entire time period will become more clear.

#### Copy and paste time range

You can copy and paste the time range from a dashboard to **Explore** and vice versa, or from one dashboard to another.
Click the **Copy time range to clipboard** icon to copy the current time range to the clipboard. Then paste the time range into **Explore** or another dashboard.

<img class="no-shadow" src="/media/docs/grafana/dashboards/screenshot-copy-paste-time-range.png" max-width="900">

You can also copy and paste a time range using the keyboard shortcuts `t+c` and `t+v` respectively.

#### Zoom out (Cmd+Z or Ctrl+Z)

Click the **Zoom out** icon to view a larger time range in the dashboard or panel visualization.

#### Zoom in (only applicable to graph visualizations)

Click and drag to select the time range in the visualization that you want to view.

#### Refresh dashboard

Click the **Refresh dashboard** icon to immediately run every query on the dashboard and refresh the visualizations. Grafana cancels any pending requests when you trigger a refresh.

By default, Grafana does not automatically refresh the dashboard. Queries run on their own schedule according to the panel settings. However, if you want to regularly refresh the dashboard, click the down arrow next to the **Refresh dashboard** icon, and then select a refresh interval.

Selecting the **Auto** interval schedules a refresh based on the query time range and browser window width. Short time ranges update frequently, while longer ones update infrequently. There is no need to refresh more often then the pixels available to draw any updates.

### Control the time range using a URL

{{< docs/shared lookup="dashboards/time-range-URLs.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Filter dashboard data

Once you've [added an ad hoc filter](ref:add-ad-hoc-filters) in the dashboard settings, you can create label/value filter pairs on the dashboard.
These filters are applied to all metric queries that use the specified data source and to all panels on the dashboard.

To filter dashboard data, follow these steps:

1. On the dashboard, click in the filter field.
1. Select a label, operator, and value.

   To add multiple values for one label, choose one of the multi-select operators, **One of** (`=|`) or **Not one of** (`!=|`). These operators only appear if the filter data source supports it.

1. Repeat this process as needed until you have all the filters you need.

   ![Ad hoc filters](/media/docs/grafana/dashboards/screenshot-adhoc-filters-v11.3.png)

### Edit or delete filters

To edit or delete filters, follow these steps:

1. On the dashboard, click anywhere on the filter you want to change.
1. Do one of the following:

   - To edit the operator or value of a filter, click anywhere on the filter and update it.

     ![Editing an ad hoc filter](/media/docs/grafana/dashboards/screenshot-edit-filters-v11.3.png)

   - To change the filter label, you must delete the filter and create a new one.
   - To delete a filter, click the **X** next to it.
