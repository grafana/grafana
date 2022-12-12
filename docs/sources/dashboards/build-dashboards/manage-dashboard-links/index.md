---
aliases:
  - ../../features/navigation-links/
  - ../../linking/
  - ../../linking/dashboard-links/
  - ../../linking/linking-overview/
  - ../../panels/working-with-panels/add-link-to-panel/
  - ../manage-dashboard-links/
description: How to link Grafana dashboards.
keywords:
  - link
  - dashboard
  - grafana
  - linking
  - create links
  - link dashboards
  - navigate
menuTitle: Manage dashboard links
title: Manage dashboard links
weight: 500
---

# Manage dashboard links

You can use links to navigate between commonly-used dashboards or to connect others to your visualizations. Links let you create shortcuts to other dashboards, panels, and even external websites.

Grafana supports dashboard links, panel links, and data links. Dashboard links are displayed at the top of the dashboard. Panel links are accessible by clicking an icon on the top left corner of the panel.

## Which link should you use?

Start by figuring out how you're currently navigating between dashboards. If you're often jumping between a set of dashboards and struggling to find the same context in each, links can help optimize your workflow.

The next step is to figure out which link type is right for your workflow. Even though all the link types in Grafana are used to create shortcuts to other dashboards or external websites, they work in different contexts.

- If the link relates to most if not all of the panels in the dashboard, use [dashboard links]({{< relref "#dashboard-links" >}}).
- If you want to drill down into specific panels, use [panel links]({{< relref "#panel-links" >}}).
- If you want to link to an external site, you can use either a dashboard link or a panel link.
- If you want to drill down into a specific series, or even a single measurement, use [data links]({{< relref "../../../panels-visualizations/configure-data-links/#data-links" >}}).

## Controlling time range using the URL

To control the time range of a panel or dashboard, you can provide query parameters in the dashboard URL:

- `from` - defines lower limit of the time range, specified in ms epoch
- `to` - defines upper limit of the time range, specified in ms epoch
- `time` and `time.window` - defines a time range from `time-time.window/2` to `time+time.window/2`. Both params should be specified in ms. For example `?time=1500000000000&time.window=10000` will result in 10s time range from 1499999995000 to 1500000005000

## Dashboard links

When you create a dashboard link, you can include the time range and current template variables to directly jump to the same context in another dashboard. This way, you don’t have to worry whether the person you send the link to is looking at the right data. For other types of links, refer to [Data link variables]({{< relref "../../../panels-visualizations/configure-data-links/#data-link-variables/" >}}).

Dashboard links can also be used as shortcuts to external systems, such as submitting [a GitHub issue with the current dashboard name](https://github.com/grafana/grafana/issues/new?title=Dashboard%3A%20HTTP%20Requests).

To see an example of dashboard links in action, check out:

- [Dashboard links with variables](https://play.grafana.org/d/rUpVRdamz/dashboard-links-with-variables?orgId=1)
- [Prometheus repeat](https://play.grafana.org/d/000000036/prometheus-repeat?orgId=1)

Once you've added a dashboard link, it appears in the upper right corner of your dashboard.

### Add links to dashboards

Add links to other dashboards at the top of your current dashboard.

1. While viewing the dashboard you want to link, click the gear at the top of the screen to open **Dashboard settings**.
1. Click **Links** and then click **Add Dashboard Link** or **New**.
1. In **Type**, select **dashboards**.
1. Select link options:
   - **With tags** – Enter tags to limit the linked dashboards to only the ones with the tags you enter. Otherwise, Grafana includes links to all other dashboards.
   - **As dropdown** – If you are linking to lots of dashboards, then you probably want to select this option and add an optional title to the dropdown. Otherwise, Grafana displays the dashboard links side by side across the top of your dashboard.
   - **Time range** – Select this option to include the dashboard time range in the link. When the user clicks the link, the linked dashboard opens with the indicated time range already set. **Example:** https://play.grafana.org/d/000000010/annotations?orgId=1&from=now-3h&to=now
   - **Variable values** – Select this option to include template variables currently used as query parameters in the link. When the user clicks the link, any matching templates in the linked dashboard are set to the values from the link. For more information, see [Dashboard URL variables]({{< relref "../create-dashboard-url-variables/" >}}).
   - **Open in new tab** – Select this option if you want the dashboard link to open in a new tab or window.
1. Click **Add**.

### Add a URL link to a dashboard

Add a link to a URL at the top of your current dashboard. You can link to any available URL, including dashboards, panels, or external sites. You can even control the time range to ensure the user is zoomed in on the right data in Grafana.

1. While viewing the dashboard you want to link, click the gear at the top of the screen to open **Dashboard settings**.
1. Click **Links** and then click **Add Dashboard Link** or **New**.
1. In **Type**, select **link**.
1. Select link options:
   - **Url** – Enter the URL you want to link to. Depending on the target, you might want to include field values. **Example:** https://github.com/grafana/grafana/issues/new?title=Dashboard%3A%20HTTP%20Requests
   - **Title** – Enter the title you want the link to display.
   - **Tooltip** – Enter the tooltip you want the link to display when the user hovers their mouse over it.
   - **Icon** – Choose the icon you want displayed with the link.
   - **Time range** – Select this option to include the dashboard time range in the link. When the user clicks the link, the linked dashboard opens with the indicated time range already set. **Example:** https://play.grafana.org/d/000000010/annotations?orgId=1&from=now-3h&to=now
     - `from` - Defines the lower limit of the time range, specified in ms epoch.
     - `to` - Defines the upper limit of the time range, specified in ms epoch.
     - `time` and `time.window` - Define a time range from `time-time.window/2` to `time+time.window/2`. Both params should be specified in ms. For example `?time=1500000000000&time.window=10000` will result in 10s time range from 1499999995000 to 1500000005000.
   - **Variable values** – Select this option to include template variables currently used as query parameters in the link. When the user clicks the link, any matching templates in the linked dashboard are set to the values from the link. Here is the variable format: `https://${you-domain}/path/to/your/dashboard?var-${template-varable1}=value1&var-{template-variable2}=value2` **Example:** https://play.grafana.org/d/000000074/alerting?var-app=backend&var-server=backend_01&var-server=backend_03&var-interval=1h
   - **Open in new tab** – Select this option if you want the dashboard link to open in a new tab or window.
1. Click **Add**.

### Update a dashboard link

To change or update an existing dashboard link, follow this procedure.

1. In Dashboard Settings, on the Links tab, click the existing link that you want to edit.
1. Change the settings and then click **Update**.

## Duplicate a dashboard link

To duplicate an existing dashboard link, click the duplicate icon next to the existing link that you want to duplicate.

### Delete a dashboard link

To delete an existing dashboard link, click the trash icon next to the duplicate icon that you want to delete.

## Panel links

Each panel can have its own set of links that are shown in the upper left corner of the panel. You can link to any available URL, including dashboards, panels, or external sites. You can even control the time range to ensure the user is zoomed in on the right data in Grafana.

Click the icon on the top left corner of a panel to see available panel links.

{{< figure src="/static/img/docs/linking/panel-links.png" width="200px" >}}

### Add a panel link

1. Hover your cursor over the panel that you want to add a link to and then press `e`. Or click the dropdown arrow next to the panel title and then click **Edit**.
1. On the Panel tab, scroll down to the Links section.
1. Expand Links and then click **Add link**.
1. Enter a **Title**. **Title** is a human-readable label for the link that will be displayed in the UI.
1. Enter the **URL** you want to link to.
   You can even add one of the template variables defined in the dashboard. Press Ctrl+Space or Cmd+Space and click in the **URL** field to see the available variables. By adding template variables to your panel link, the link sends the user to the right context, with the relevant variables already set. You can also use time variables:
   - `from` - Defines the lower limit of the time range, specified in ms epoch.
   - `to` - Defines the upper limit of the time range, specified in ms epoch.
   - `time` and `time.window` - Define a time range from `time-time.window/2` to `time+time.window/2`. Both params should be specified in ms. For example `?time=1500000000000&time.window=10000` will result in 10s time range from 1499999995000 to 1500000005000.
1. If you want the link to open in a new tab, then select **Open in a new tab**.
1. Click **Save** to save changes and close the window.
1. Click **Save** in the upper right to save your changes to the dashboard.

### Update a panel link

1. On the Panel tab, find the link that you want to make changes to.
1. Click the Edit (pencil) icon to open the Edit link window.
1. Make any necessary changes.
1. Click **Save** to save changes and close the window.
1. Click **Save** in the upper right to save your changes to the dashboard.

### Delete a panel link

1. On the Panel tab, find the link that you want to delete.
1. Click the **X** icon next to the link you want to delete.
1. Click **Save** in the upper right to save your changes to the dashboard.
