---
description: ''
keywords:
  - grafana
  - linking
  - create links
  - link dashboards
  - navigate
title: Dashboard links
weight: 200
---

# Dashboard links

When you create a dashboard link, you can include the time range and current template variables to directly jump to the same context in another dashboard. This way, you don’t have to worry whether the person you send the link to is looking at the right data. For other types of links, refer to [Data link variables]({{< relref "data-link-variables.md" >}}).

Dashboard links can also be used as shortcuts to external systems, such as submitting [a GitHub issue with the current dashboard name](https://github.com/grafana/grafana/issues/new?title=Dashboard%3A%20HTTP%20Requests).

To see an example of dashboard links in action, check out:

- [Dashboard links with variables](https://play.grafana.org/d/rUpVRdamz/dashboard-links-with-variables?orgId=1)
- [Prometheus repeat](https://play.grafana.org/d/000000036/prometheus-repeat?orgId=1)

Once you've added a dashboard link, it appears in the upper right corner of your dashboard.

## Add links to dashboards

Add links to other dashboards at the top of your current dashboard.

1. While viewing the dashboard you want to link, click the gear at the top of the screen to open **Dashboard settings**.
1. Click **Links** and then click **Add Dashboard Link** or **New**.
1. In **Type**, select **dashboards**.
1. Select link options:
   - **With tags** – Enter tags to limit the linked dashboards to only the ones with the tags you enter. Otherwise, Grafana includes links to all other dashboards.
   - **As dropdown** – If you are linking to lots of dashboards, then you probably want to select this option and add an optional title to the dropdown. Otherwise, Grafana displays the dashboard links side by side across the top of your dashboard.
   - **Time range** – Select this option to include the dashboard time range in the link. When the user clicks the link, the linked dashboard opens with the indicated time range already set. **Example:** https://play.grafana.org/d/000000010/annotations?orgId=1&from=now-3h&to=now
   - **Variable values** – Select this option to include template variables currently used as query parameters in the link. When the user clicks the link, any matching templates in the linked dashboard are set to the values from the link. Here is the variable format: `https://${you-domain}/path/to/your/dashboard?var-${template-variable1}=value1&var-${template-variable2}=value2` **Example:** https://play.grafana.org/d/000000074/alerting?var-app=backend&var-server=backend_01&var-server=backend_03&var-interval=1h
   - **Open in new tab** – Select this option if you want the dashboard link to open in a new tab or window.
1. Click **Add**.

## Add a URL link to a dashboard

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

## Update a dashboard link

To change or update an existing dashboard link, follow this procedure.

1. In Dashboard Settings, on the Links tab, click the existing link that you want to edit.
1. Change the settings and then click **Update**.

## Duplicate a dashboard link

To duplicate an existing dashboard link, click the duplicate icon next to the existing link that you want to duplicate.

## Delete a dashboard link

To delete an existing dashboard link, click the trash icon next to the duplicate icon that you want to delete.
