---
aliases:
  - ../../reference/search/ # /docs/grafana/next/reference/search/
  - ../../dashboards/dashboard-ui/ # /docs/grafana/next/dashboards/dashboard-ui/
  - ../../dashboards/dashboard-ui/dashboard-header/ # /docs/grafana/next/dashboards/dashboard-ui/dashboard-header/
  - ../../dashboards/dashboard-ui/dashboard-row/ # /docs/grafana/next/dashboards/dashboard-ui/dashboard-row/
  - ../../dashboards/search/ # /docs/grafana/next/dashboards/search/
  - ../../dashboards/shortcuts/ # /docs/grafana/next/dashboards/shortcuts/
  - ../../dashboards/time-range-controls/ # /docs/grafana/next/dashboards/time-range-controls/
  - ../../dashboards/use-dashboards/ # /docs/grafana/next/dashboards/use-dashboards/
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
image_maps:
  - key: annotated-dashboard
    src: /media/docs/grafana/dashboards/screenshot-ann-dashboards-v12.4.png
    alt: An annotated image of a Grafana dashboard
    points:
      - x_coord: 8
        y_coord: 5
        content: |
          **Dashboard folder**

          Click the dashboard folder name to access the folder and perform other [folder management tasks](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/manage-dashboards/).
      - x_coord: 17
        y_coord: 5
        content: |
          **Dashboard title**

          Create your own dashboard titles or have Grafana create them for you using [generative AI features](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/manage-dashboards/#set-up-generative-ai-features-for-dashboards).
      - x_coord: 23
        y_coord: 5
        content: |
          **Mark as favorite**

          Mark the dashboard as one of your favorites to include it in your list of **Starred** dashboards in the main menu.
      - x_coord: 27
        y_coord: 5
        content: |
          **Public label**

          [Externally shared dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/share-dashboards-panels/shared-dashboards/), it's marked with the **Public** label.
      - x_coord: 84
        y_coord: 5
        content: |
          **Grafana Assistant**

          [Grafana Assistant](https://grafana.com/docs/grafana-cloud/machine-learning/assistant/introduction/) combines large language models with Grafana-integrated tools.
      - x_coord: 89
        y_coord: 5
        content: |
          **Invite new users**

          Invite new users to join your Grafana organization.
      - x_coord: 32
        y_coord: 23
        content: |
          **Variables**

          Use [variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/), including ad hoc filters, to create more interactive and dynamic dashboards.
      - x_coord: 45
        y_coord: 23
        content: |
          **Dashboard links**

          Link to other dashboards, panels, and external websites. Learn more about [dashboard links](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/manage-dashboard-links/).
      - x_coord: 59
        y_coord: 29
        content: |
          **Current dashboard time range and time picker**

          Select [relative time range](#relative-time-range) options or set custom [absolute time ranges](#absolute-time-range).
          You can also change the **Timezone** and **Fiscal year** settings by clicking the **Change time settings** button.
      - x_coord: 67
        y_coord: 29
        content: |
          **Time range zoom out**

          Click to zoom out the time range. Learn more about [common time range controls](#common-time-range-controls).
      - x_coord: 73
        y_coord: 29
        content: |
          **Refresh dashboard**

          Trigger queries and refresh dashboard data.
      - x_coord: 78
        y_coord: 29
        content: |
          **Auto refresh control**

          Select a dashboard auto refresh time interval.
      - x_coord: 85
        y_coord: 29
        content: |
          **Share dashboard**

          Access [dashboard sharing](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/share-dashboards-panels/) options.
      - x_coord: 98
        y_coord: 22.5
        content: |
          **Edit**

          Enter edit mode, so you can make changes and access dashboard settings.
      - x_coord: 98
        y_coord: 31
        content: |
          **Export**

          Access [dashboard exporting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/share-dashboards-panels/#export-dashboards) options.
      - x_coord: 98
        y_coord: 39
        content: |
          **Content outline**

          The outline provides a tree-like structure that lets you quickly navigate the dashboard.
      - x_coord: 98
        y_coord: 47
        content: |
          **Dashboard insights**

          View [dashboard analytics](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/assess-dashboard-usage/) including information about users, activity, query counts.
      - x_coord: 11.5
        y_coord: 30
        content: |
          **Row title**

          A row is one way you can [group panels](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard/#panel-groupings) in a dashboard.
      - x_coord: 20
        y_coord: 36
        content: |
          **Tab title**

          A tab is one way you can [group panels](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard/#panel-groupings) in a dashboard.
      - x_coord: 21
        y_coord: 45
        content: |
          **Panel title**

          Create your own panel titles or have Grafana create them for you using [generative AI features](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/manage-dashboards/#set-up-generative-ai-features-for-dashboards).
      - x_coord: 27
        y_coord: 63
        content: |
          **Dashboard panel**

          The [panel](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/panel-overview/) is the primary building block of a dashboard.
      - x_coord: 19.5
        y_coord: 91
        content: |
          **Panel legend**

          Change series colors as well as y-axis and series visibility directly from the legend.
---

# Use dashboards

This topic provides an overview of dashboard features and shortcuts, and describes how to use dashboard search.

{{< youtube id="vTiIkdDwT-0" >}}

## Dashboard feature overview

The dashboard user interface provides a number of features that you can use to customize the presentation of your data.

The following image and descriptions highlight all dashboard features.
Hover your cursor over a number to display information about the dashboard element.

{{< image-map key="annotated-dashboard" >}}

## Keyboard shortcuts

Grafana has a number of keyboard shortcuts available. Press `?` on your keyboard to display all keyboard shortcuts available in your version of Grafana.

- `Ctrl+S`: Saves the current dashboard.
- `f`: Opens the dashboard finder / search.
- `d+k`: Toggle kiosk mode (hides the menu).
- `d+e`: Expand all rows.
- `d+s`: Dashboard settings.
- `Ctrl+K`: Opens the command palette.
- `Esc`: Exits panel when in full screen view or edit mode. Also returns you to the dashboard from dashboard settings.

### Focused panel

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

{{< admonition type="note" >}}

Grafana Alerting does not support the following syntaxes at this time:

- now+n for future timestamps.
- now-1n/n for "start of n until end of n" because this is an absolute timestamp.

{{< /admonition >}}

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

You can enter a custom relative time range into the search at the top to quickly select, such as `13h` to select a time range for the last 13 hours.

#### Absolute time range

You can set an absolute time range in the following ways:

- Type values into the **From** and **To** fields. You can type exact time values or relative values, such as `now-24h`, and then click **Apply time range**.
- Click in the **From** or **To** field. Grafana displays a calendar. Click the day or days you want to use as the current time range and then click **Apply time range**.

This section also displays recently used absolute ranges.

#### Semi-relative time range

{{< admonition type="note" >}}

Grafana Alerting does not support semi-relative time ranges.

{{< /admonition >}}

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

#### Zoom out

- Click the **Zoom out** icon to view a larger time range in the dashboard or panel visualizations
- Double click on the panel graph area (time series family visualizations only)
- Type the `t-` keyboard shortcut

#### Zoom in

- Click and drag horizontally in the panel graph area to select a time range (time series family visualizations only)
- Type the `t+` keyboard shortcut

#### Refresh dashboard

Click the **Refresh dashboard** icon to immediately run every query on the dashboard and refresh the visualizations. Grafana cancels any pending requests when you trigger a refresh.

By default, Grafana does not automatically refresh the dashboard. Queries run on their own schedule according to the panel settings. However, if you want to regularly refresh the dashboard, click the down arrow next to the **Refresh dashboard** icon, and then select a refresh interval.

Selecting the **Auto** interval schedules a refresh based on the query time range and browser window width. Short time ranges update frequently, while longer ones update infrequently. There is no need to refresh more often then the pixels available to draw any updates.

### Control the time range using a URL

{{< docs/shared lookup="dashboards/time-range-URLs.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Filter dashboard data

Once you've [added an ad hoc filter](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#add-ad-hoc-filters) in the dashboard settings, you can create label/value filter pairs on the dashboard.
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
