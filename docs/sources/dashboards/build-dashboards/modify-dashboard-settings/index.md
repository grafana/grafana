---
title: Modify dashboard settings
menuTitle: Dashboard settings
weight: 8
keywords:
  - time settings
  - variables
  - links
  - dashboard
  - settings
---

# Modify dashboard settings

The dashboard settings page enables you to:

- Edit general dashboard properties, including time settings
- Add annotation queries
- Add dashboard variables
- Add links
- View the dashboard JSON model

To access the dashboard setting page:

1. Open a dashboard in edit mode.
1. Click **Dashboard settings** (gear icon) located at the top of the page.

## Modify dashboard time settings

Adjust dashboard time settings when you want to change the dashboard timezone, the local browser time, and specify auto-refresh time intervals.

1. On the **Dashboard settings** page, click **General**.
1. Navigate to the **Time Options** section.
1. Specify time settings according to the following descriptions.

   - **Timezone:** Specify the local time zone of the service or system that you are monitoring. This can be helpful when monitoring a system or service that operates across several time zones.
     - **Default:** Grafana uses the default selected time zone for the user profile, team, or organization. If no time zone is specified for the user profile, a team the user is a member of, or the organization, then Grafana uses the local browser time.
     - **Local browser time:** The time zone configured for the viewing user browser is used. This is usually the same time zone as set on the computer.
     - Standard [ISO 8601 time zones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones), including UTC.
   - **Auto-refresh:** Customize the options displayed for relative time and the auto-refresh options Entries are comma separated and accept any valid time unit.
   - **Now delay:** Override the `now` time by entering a time delay. Use this option to accommodate known delays in data aggregation to avoid null values.
   - **Hide time picker:** Select this option if you do not want Grafana to display the time picker.

## Add an annotation query

An annotation query is a query that queries for events. These events can be visualized in graphs across the dashboard as vertical lines along with a small
icon you can hover over to see the event information.

1. On the **Dashboard settings** page, click **Annotations**.
1. Click **Add annotation query**.
1. Enter a name and select a data source.
1. Complete the rest of the form to build a query and annotation.

The query editor UI changes based on the data source you select. Refer to the [Data source]({{< relref "../../../datasources/" >}}) documentation for details on how to construct a query.

## Add a variable

Variables enable you to create more interactive and dynamic dashboards. Instead of hard-coding things like server, application,
and sensor names in your metric queries, you can use variables in their place. Variables are displayed as dropdown lists at the top of
the dashboard. These dropdowns make it easy to change the data being displayed in your dashboard.

For more information about variables, refer to [Variables]({{< relref "../../variables/" >}}).

1. On the **Dashboard settings** page, click **Variable** in the left side section menu and then the **Add variable** button.
1. In the **General** section, the the name of the variable. This is the name that you will later use in queries.
1. Select a variable **Type**.

   > **Note:** The variable type you select impacts which fields you populate on the page.

1. Define the variable and click **Update**.

## Add a link

Dashboard links enable you to place links to other dashboards and web sites directly below the dashboard header. Links provide for easy navigation to other, related dashboards and content.

1. On the **Dashboard settings** page, click **Links** in the left side section menu and then the **Add link** button.
1. Enter title and and in the **Type** field, select **Dashboard** or **Link**.
1. To add a dashboard link:
   a. Add an optional tag. Tags are useful creating a dynamic dropdown of dashboards that all have a specific tag.
   b. Select any of the dashboard link **Options**.
   c. Click **Apply**.
1. To add a link:
   a. Add a URL and tooltip text that appears when the user hovers over the link.
   b. Select an icon that appears next to the link.
   c. Select any of the dashboard link **Options**.

## View dashboard JSON model

A dashboard in Grafana is represented by a JSON object, which stores metadata of its dashboard. Dashboard metadata includes dashboard properties, metadata from panels, template variables, panel queries, and so on.

To view a dashboard JSON model, on the **Dashboard settings** page, click **JSON**.

For more information about the JSON fields, refer to [JSON fields]({{< relref "../view-dashboard-json-model/#json-fields" >}}).
