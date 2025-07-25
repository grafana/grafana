---
keywords:
  - time settings
  - variables
  - links
  - dashboard
  - settings
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Modify dashboard settings
title: Modify dashboard settings
description: Manage and edit your dashboard settings
weight: 8
refs:
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/
  json-fields:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/view-dashboard-json-model/#json-fields
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/view-dashboard-json-model/#json-fields
  data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/
  dashboard-links:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/manage-dashboard-links/#dashboard-links
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/manage-dashboard-links/#dashboard-links
---

# Modify dashboard settings

The dashboard settings page allows you to:

- Edit general dashboard properties, including time settings
- Add annotation queries
- Add dashboard variables
- Add links
- View the dashboard JSON model

To access the dashboard setting page:

1. Click **Edit** in the top-right corner of the dashboard.
1. Click **Settings**.

## Modify dashboard time settings

Adjust dashboard time settings when you want to change the dashboard timezone, the local browser time, and specify auto-refresh time intervals.

1. On the **Settings** page, scroll down to the **Time Options** section of the **General** tab.
1. Specify time settings as follows.
   - **Time zone:** Specify the local time zone of the service or system that you are monitoring. This can be helpful when monitoring a system or service that operates across several time zones.
     - **Default:** Grafana uses the default selected time zone for the user profile, team, or organization. If no time zone is specified for the user profile, a team the user is a member of, or the organization, then Grafana uses the local browser time.
     - **Browser time:** The time zone configured for the viewing user browser is used. This is usually the same time zone as set on the computer.
     - Standard [ISO 8601 time zones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones), including UTC.
   - **Auto refresh:** Customize the options displayed for relative time and the auto-refresh options Entries are comma separated and accept any valid time unit.
   - **Now delay:** Override the `now` time by entering a time delay. Use this option to accommodate known delays in data aggregation to avoid null values.
   - **Hide time picker:** Select this option if you do not want Grafana to display the time picker.

1. Click **Save dashboard**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

## Add tags

You can add metadata to your dashboards using tags. Tags also give you the ability to filter the list of dashboards.

Tags can be up to 50 characters long, including spaces.

To add tags to a dashboard, follow these steps:

1. On the **Settings** page, scroll down to the **Tags** section of the **General** tab.
1. In the field, enter a new or existing tag.

   If you're entering an existing tag, make sure that you spell it the same way or a new tag is created.

1. Click **Add** or press the Enter key.
1. Click **Save dashboard**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

When you're on the **Dashboards** page, any tags you've entered show up under the **Tags** column.

## Add an annotation query

An annotation query is a query that queries for events. These events can be visualized in graphs across the dashboard as vertical lines along with a small
icon you can hover over to see the event information.

1. On the **Settings** page, go to the **Annotations** tab.
1. Click **Add annotation query**.
1. Enter a name and select a data source.
1. Complete the rest of the form to build a query and annotation.
1. Click **Save dashboard**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

The query editor UI changes based on the data source you select. Refer to the [Data source](ref:data-source) documentation for details on how to construct a query.

## Add a variable

Variables enable you to create more interactive and dynamic dashboards. Instead of hard-coding things like server, application,
and sensor names in your metric queries, you can use variables in their place. Variables are displayed as dropdown lists at the top of
the dashboard. These dropdowns make it easy to change the data being displayed in your dashboard.

For more information about variables, refer to [Variables](ref:variables).

1. On the **Settings** page, go to the **Variables** tab.
1. Click **+ New variable**.
1. In the **Select variable type** drop-down, choose an option.

   The variable type you select impacts which fields you populate on the page.

1. In the **General** section, enter the name of the variable.

   This is the name that you'll use later in queries.

1. Set the rest of the variable options.
1. Click **Save dashboard**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

## Add a link

Dashboard links enable you to place links to other dashboards and web sites directly below the dashboard header. Links provide for easy navigation to other, related dashboards and content.

1. On the **Settings** page, click the **Links** tab.
1. Click **+ New link**.
1. Enter title for the link.
1. In the **Type** drop-down, select **Dashboards** or **Link**.
1. Set the rest of the link options.

   For more detailed directions on creating links, refer to [Dashboard links](ref:dashboard-links)

1. Click **Save dashboard**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Exit edit**.

## View dashboard JSON model

A dashboard in Grafana is represented by a JSON object, which stores metadata of its dashboard. Dashboard metadata includes dashboard properties, metadata from panels, template variables, panel queries, and so on.

To view a dashboard JSON model, on the **Settings** page, click the **JSON Model** tab.

For more information about the JSON fields, refer to [JSON fields](ref:json-fields).
