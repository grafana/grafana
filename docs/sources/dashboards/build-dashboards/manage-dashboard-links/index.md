---
aliases:
  - ../../features/navigation-links/
  - ../../linking/
  - ../../linking/dashboard-links/
  - ../../linking/linking-overview/
  - ../../panels/working-with-panels/add-link-to-panel/
  - ../manage-dashboard-links/
description: Add links to your Grafana dashboards to connect to other dashboards, panels, and websites
keywords:
  - link
  - dashboard
  - grafana
  - linking
  - create links
  - link dashboards
  - navigate
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Manage dashboard links
title: Manage dashboard links
weight: 200
refs:
  data-links:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-data-links/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-data-links/
  data-link-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-data-links/#data-link-variables
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/configure-data-links/#data-link-variables
  dashboard-url-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/create-dashboard-url-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/create-dashboard-url-variables/
---

# Manage dashboard links

You can use links to navigate between commonly-used dashboards or to connect others to your visualizations. Links let you create shortcuts to other dashboards, panels, and even external websites.

Grafana supports dashboard links, panel links, and data links. Dashboard links are displayed at the top of the dashboard. Panel links are accessible by clicking the icon next to the panel title.

## Which link should you use?

Start by figuring out how you're currently navigating between dashboards. If you're often jumping between a set of dashboards and struggling to find the same context in each, links can help optimize your workflow.

The next step is to figure out which link type is right for your workflow. Even though all the link types in Grafana are used to create shortcuts to other dashboards or external websites, they work in different contexts.

- If the link relates to most if not all of the panels in the dashboard, use [dashboard links](#dashboard-links).
- If you want to drill down into specific panels, use [panel links](#panel-links).
- If you want to link to an external site, you can use either a dashboard link or a panel link.
- If you want to drill down into a specific series, or even a single measurement, use [data links](ref:data-links).

## Controlling time range using the URL

To control the time range of a panel or dashboard, you can provide query parameters in the dashboard URL:

- `from` - defines lower limit of the time range, specified in ms epoch
- `to` - defines upper limit of the time range, specified in ms epoch
- `time` and `time.window` - defines a time range from `time-time.window/2` to `time+time.window/2`. Both params should be specified in ms. For example `?time=1500000000000&time.window=10000` will result in 10s time range from 1499999995000 to 1500000005000

## Dashboard links

When you create a dashboard link, you can include the time range and current template variables to directly jump to the same context in another dashboard. This way, you don’t have to worry whether the person you send the link to is looking at the right data. For other types of links, refer to [Data link variables](ref:data-link-variables).

Dashboard links can also be used as shortcuts to external systems, such as submitting [a GitHub issue with the current dashboard name](https://github.com/grafana/grafana/issues/new?title=Dashboard%3A%20HTTP%20Requests).

To see an example of dashboard links in action, check out:

- [Dashboard links with variables](https://play.grafana.org/d/rUpVRdamz/dashboard-links-with-variables?orgId=1)
- [Prometheus repeat](https://play.grafana.org/d/000000036/prometheus-repeat?orgId=1)

Once you've added a dashboard link, it appears in the upper right corner of your dashboard.

### Add links to dashboards

Add links to other dashboards at the top of your current dashboard.

1. In the dashboard you want to link, click **Edit**.
1. Click **Settings**.
1. Go to the **Links** tab and then click **Add dashboard link**.

   The default link type is **Dashboards**.

1. In the **With tags** drop-down, enter tags to limit the linked dashboards to only the ones with the tags you enter.

   If you don't add any tags, Grafana includes links to all other dashboards.

1. Set link options:

   - **Show as dropdown** – If you are linking to lots of dashboards, then you probably want to select this option and add an optional title to the dropdown. Otherwise, Grafana displays the dashboard links side by side across the top of your dashboard.
   - **Include current time range** – Select this option to include the dashboard time range in the link. When the user clicks the link, the linked dashboard opens with the indicated time range already set. **Example:** https://play.grafana.org/d/000000010/annotations?orgId=1&from=now-3h&to=now
   - **Include current template variable values** – Select this option to include template variables currently used as query parameters in the link. When the user clicks the link, any matching templates in the linked dashboard are set to the values from the link. For more information, see [Dashboard URL variables](ref:dashboard-url-variables).
   - **Open link in new tab** – Select this option if you want the dashboard link to open in a new tab or window.

1. Click **Save dashboard** in the top-right corner.
1. Click **Back to dashboard** and then **Exit edit**.

### Add a URL link to a dashboard

Add a link to a URL at the top of your current dashboard. You can link to any available URL, including dashboards, panels, or external sites. You can even control the time range to ensure the user is zoomed in on the right data in Grafana.

1. In the dashboard you want to link, click **Edit**.
1. Click **Settings**.
1. Go to the **Links** tab and then click **Add dashboard link**.
1. In the **Type** drop-down, select **Link**.
1. In the **URL** field, enter the URL to which you want to link.

   Depending on the target, you might want to include field values. **Example:** https://github.com/grafana/grafana/issues/new?title=Dashboard%3A%20HTTP%20Requests

1. In the **Tooltip** field, enter the tooltip you want the link to display when the user hovers their mouse over it.
1. In the **Icon** drop-down, choose the icon you want displayed with the link.
1. Set link options; by default, these options are enabled for URL links:

   - **Include current time range** – Select this option to include the dashboard time range in the link. When the user clicks the link, the linked dashboard opens with the indicated time range already set. **Example:** https://play.grafana.org/d/000000010/annotations?orgId=1&from=now-3h&to=now
   - **Include current template variable values** – Select this option to include template variables currently used as query parameters in the link. When the user clicks the link, any matching templates in the linked dashboard are set to the values from the link.
   - **Open link in new tab** – Select this option if you want the dashboard link to open in a new tab or window.

1. Click **Save dashboard** in the top-right corner.
1. Click **Back to dashboard** and then **Exit edit**.

### Update a dashboard link

To edit, duplicate, or delete dashboard link, follow these steps:

1. In the dashboard you want to link, click **Edit**.
1. Click **Settings**.
1. Go to the **Links** tab.
1. Do one of the following:

   - **Edit** - Click the name of the link and update the link settings.
   - **Duplicate** - Click the copy link icon next to the link that you want to duplicate.
   - **Delete** - Click the red **X** next to the link that you want to delete, and then **Delete**.

1. Click **Save dashboard**.
1. Click **Back to dashboard** and then **Exit edit**.

## Panel links

Each panel can have its own set of links that are shown in the upper left of the panel after the panel title. You can link to any available URL, including dashboards, panels, or external sites. You can even control the time range to ensure the user is zoomed in on the right data in Grafana.

Click the icon next to the panel title to see available panel links.

{{< figure src="/media/docs/grafana/dashboards/screenshot-panel-links-v11.3.png" max-width="550px" alt="List of panel links displayed" >}}

### Add a panel link

1. Hover over any part of the panel to which you want to add the link to display the actions menu on the top right corner.
1. Click the menu and select **Edit**.

   To use a keyboard shortcut to open the panel, hover over the panel and press `e`.

1. Expand the **Panel options** section, scroll down to **Panel links**.
1. Click **Add link**.
1. Enter a **Title**. **Title** is a human-readable label for the link that will be displayed in the UI.
1. Enter the **URL** you want to link to.
   You can even add one of the template variables defined in the dashboard. Press Ctrl+Space or Cmd+Space and click in the **URL** field to see the available variables. By adding template variables to your panel link, the link sends the user to the right context, with the relevant variables already set. You can also use time variables:
   - `from` - Defines the lower limit of the time range, specified in ms epoch.
   - `to` - Defines the upper limit of the time range, specified in ms epoch.
   - `time` and `time.window` - Define a time range from `time-time.window/2` to `time+time.window/2`. Both params should be specified in ms. For example `?time=1500000000000&time.window=10000` will result in 10s time range from 1499999995000 to 1500000005000.
1. If you want the link to open in a new tab, then select **Open in new tab**.
1. Click **Save** to save changes and close the dialog box.
1. Click **Save dashboard** in the top-right corner.
1. Click **Back to dashboard** and then **Exit edit**.

### Update a panel link

1. Hover over any part of the panel to display the actions menu on the top right corner.
1. Click the menu and select **Edit**.

   To use a keyboard shortcut to open the panel, hover over the panel and press `e`.

1. Expand the **Panel options** section, scroll down to Panel links.
1. Find the link that you want to make changes to.
1. Click the Edit (pencil) icon to open the Edit link window.
1. Make any necessary changes.
1. Click **Save** to save changes and close the dialog box.
1. Click **Save dashboard** in the top-right corner.
1. Click **Back to dashboard** and then **Exit edit**.

### Delete a panel link

1. Hover over any part of the panel to display the actions menu on the top right corner.
1. Click the menu and select **Edit**.

   To use a keyboard shortcut to open the panel, hover over the panel and press `e`.

1. Expand the **Panel options** section, scroll down to Panel links.
1. Find the link that you want to delete.
1. Click the **X** icon next to the link you want to delete.
1. Click **Save dashboard** in the top-right corner.
1. Click **Back to dashboard** and then **Exit edit**.
