---
aliases:
  - /docs/grafana/latest/dashboards/build-dashboards/modify-dashboard-settings/
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

- edit general dashboard properties, including time settings
- add annotation queries
- add dashboard variables
- add links
- view the dashboard JSON model

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

An annotation query is a query that xxx. An annotation query provides the following benefits:

- xxx
- xxx
- xxx

**Before you begin:**

- Ensure that you are familiar with the query language of the data source you select.

**To add an annotation query:**

1. On the **Dashboard settings** page, click **Annotations**.
1. Click **Add annotation query**.
1. Enter a name and select a data source.
1. Complete the rest of the form to build a query and annotation.

> **Note:** The **Dashboard settings** page is dynamic and provides a unique set of query and annotation fields for you to populate.

## Add a variable

Add a variable when you want to create interactive and dynamic dashboards that instantly update when select a variable from a picklist.

What are the benefits here? That I don't need to create 40 different dashboards each with a hard-coded value? More efficient use of dashboard space?

For more information about variables, refer to [Variables]({{< relref "../../variables/" >}}).

1. On the **Dashboard settings** page, click **Add variable**.
1. In the **General** section, complete the **Name**, **xx**, and **xx** fields.
1. Select a variable **Type**.

   > **Note:** The variable type you select impacts which fields you populate on the page.

1. Define the variable and click **Update**.

## Add a link

Dashboard Links enable you to place links to other dashboards and web sites directly below the dashboard header. Links provide for easy navigation to other, related dashboards and content.

1. On the **Dashboard settings** page, click **Add dashboard links**.
1. Enter title and and in the **Type** field, select **Dashboard** or **Link**.
1. To add a dashboard link:

   a. Add an optional tag.

   Tags are useful for filtering and sorting dashboards.

   b. Select any of the dashboard link **Options**.

   Is there anything helpful we want to say here about any of these options? Only add content here if it's not obvious what any option does.

   c. Click **Apply**.

1. To add a link:

   a. Add a URL and tooltip text that appears when the user hovers over the link.

   b. Select an icon that appears next to the link.

   c. Select any of the dashboard link **Options**.

   We can repeat guidance from above if there are any options that are not obvious to the user.

## View dashboard JSON model

A dashboard in Grafana is represented by a JSON object, which stores metadata of its dashboard. Dashboard metadata includes dashboard properties, metadata from panels, template variables, panel queries, and so on.

To view a dashboard JSON model, on the **Dashboard settings** page, click **JSON**.

For more information about the JSON fields, refer to [JSON fields]({{< relref "../view-dashboard-json-model/#json-fields" >}}).
