+++
title = "Navigation links"
description = ""
keywords = ["grafana", "linking", "create links", "link panels", "link dashboards", "navigate"]
type = "docs"
[menu.docs]
parent = "features"
weight = 9
+++

# Navigation links 

You can use links to navigate between commonly used dashboards. Links let you create shortcuts to other dashboards, panels, and even external websites.

Grafana supports three types of links: Dashboard Links, Panel Links, and Data Links. They are all available from your dashboard.

{{< docs-imagebox img="/static/assets/img/blog/dashboard_links.png" max-width="800px" caption="Links Supported in Grafana" >}}

## Which link should you use?

Start by figuring out how you're currently navigating between dashboards. If you're often jumping between a set of dashboards and struggling to find the same context in each, links can help optimize your workflow. 

The next step is to figure out which link type is right for your workflow. Even though all the link types in Grafana are used to create shortcuts to other dashboards or external websites, they work in different contexts.

- If the link relates to most if not all of the panels in the dashboard, use a *dashboard link*.
- If you want to drill down into specific panels, use a *panel link*.
- If you want to drill down into a specific series, or even a single measurement, use a *data link*.

## Dashboard links

When you create a dashboard link, you can include the time range and current template variables to directly jump to the same context in another dashboard. This way, you don’t have to worry whether the person you send the link to is looking at the right data.

Dashboard links can also be used as shortcuts to external systems, such as submitting [a GitHub issue with the current dashboard name](https://github.com/grafana/grafana/issues/new?title=Dashboard%3A%20HTTP%20Requests).

To see an example of dashboard links in action, check out [this demo](https://play.grafana.org/d/rUpVRdamz/dashboard-links-with-variables?orgId=1).

Once you've added a dashboard link, it appears in the upper right corner of your dashboard.

### Add links to dashboards

Add a links to other dashboards at the top of your current dashboard.

1. While viewing the dashboard you want to link, click the gear at the top of the screen to open **Dashboard settings**.
1. Click **Links** and then click **Add Dashboard Link** or **New**.
1. In **Type**, select **dashboards**.
1. Select link options:
   - **With tags** – Enter tags to limit the linked dashboards to only the ones with the tags you enter. Otherwise, Grafana includes links to all other dashboards.
   - **As dropdown** – If you are linking to lots of dashboards, then you probably want to select this option and add an optional title to the dropdown. Otherwise, Grafana displays the dashboard links side by side across the top of your dashboard.
   - **Time range** – Select this option to include the dashboard time range in the link. When the user clicks the link, the linked dashboard opens with the indicated time range already set. **Example:** https://play.grafana.org/d/000000010/annotations?orgId=1&from=now-3h&to=now
   - **Variable values** – Select this option to include template variables currently used as query parameters in the link. When the user clicks the link, any matching templates in the linked dashboard are set to the values from the link. **Example:** https://play.grafana.org/d/000000074/alerting?var-app=backend&var-server=backend_01&var-server=backend_03&var-interval=1h
   - **Open in new tab** – Select this option if you want the dashboard link to open in a new tab or window.
1. Click **Add**.

### Add a link to a URL

Add a link to a URL at the top of your current dashboard. You can link to any available URL, including dashboards, panels, or external sites. You can even [control the time range](https://grafana.com/docs/grafana/latest/reference/timerange/#controlling-time-range-using-url) to ensure the user is zoomed in on the right data in Grafana.

1. While viewing the dashboard you want to link, click the gear at the top of the screen to open **Dashboard settings**.
1. Click **Links** and then click **Add Dashboard Link** or **New**.
1. In **Type**, select **link**.
1. Select link options:
   - **Url** – Enter the URL you want to link to. Depending on the target, you might want to include field values. **Example:** https://github.com/grafana/grafana/issues/new?title=Dashboard%3A%20HTTP%20Requests
   - **Title** – Enter the title you want the link to display.
   - **Tooltip** – Enter the tooltip you want the link to display when the user hovers their mouse over it.
   - **Icon** – Choose the icon you want displayed with the link.
   - **Time range** – Select this option to include the dashboard time range in the link. When the user clicks the link, the linked dashboard opens with the indicated time range already set. **Example:** https://play.grafana.org/d/000000010/annotations?orgId=1&from=now-3h&to=now
   - **Variable values** – Select this option to include template variables currently used as query parameters in the link. When the user clicks the link, any matching templates in the linked dashboard are set to the values from the link. **Example:** https://play.grafana.org/d/000000074/alerting?var-app=backend&var-server=backend_01&var-server=backend_03&var-interval=1h
   - **Open in new tab** – Select this option if you want the dashboard link to open in a new tab or window.
1. Click **Add**. 

### Update a dashboard link

To change or update an existing dashboard link, follow this procedure.

1. In Dashboard Settings, on the Links tab, click the existing link that you want to edit.
1. Change the settings and then click **Update**.

### Delete a dashboard link

To delete an existing dashboard link, click the red **X** next to the existing link that you want to delete.

## Panel links

Each panel can have its own set of links that are shown in the upper left corner of the panel. You can link to any available URL, including dashboards, panels, or external sites. You can even [control the time range](https://grafana.com/docs/grafana/latest/reference/timerange/#controlling-time-range-using-url) to ensure the user is zoomed in on the right data in Grafana.

Click the icon on the top left corner of a panel to see available panel links. To see an example of panel links in action, check out [this demo](https://play.grafana.org/d/000000156/dashboard-with-panel-link?orgId=1).

### Add a panel link

1. Hover your cursor over the panel that you want to add a link to and then press `e`. Or click the dropdown arrow next to the panel title and then click **Edit**.
2. Open the **General** tab in the panel settings and then scroll down to the Panel links section.
3. Click **Add link**.
4. Enter a **Title**.
5. If you want the link to open in a new tab, then select **Open in a new tab**.
6. Enter the **URL** you want to link to.
   You can even add one of the template variables that are available. Press Ctrl+Space in the **URL** field to see the available variables. By adding template variables to your panel ink, the link sends the user to the right context, with the relevant variables already set.

### Update or delete a panel link

On the panel settings General tab, in the Panel links section, find the panel link that you want to make changes to or delete. Make any necessary changes, or click the **X** to the right of the title to delete the link.

## Data links

Data links allow you to provide more granular context to your links. You can create links that include the series name or even the value under the cursor. For example, if your visualization showed four servers, you could add a data link to one or two of them.

Click directly on the panel to see the data link. It appears on the context menu under **Add annotation**.

To see an example of data links in action, check out [this demo](https://play.grafana.org/d/ZvPm55mWk/new-features-in-v6-3?orgId=1&fullscreen&panelId=27).

## Add a data link to a panel

Currently, data links are only supported in the Graph, Stat, Gauge, and Bar Gauge visualizations.

1. Hover your cursor over the panel that you want to add a link to and then press `e`. Or click the dropdown arrow next to the panel title and then click **Edit**.
1. Open the **Visualization** tab in the panel settings and then scroll down to the Data links section.
1. Click **Add link**.
1. Enter a **Title**.
1. If you want the link to open in a new tab, then select **Open in a new tab**.
1. Enter the **URL** you want to link to.
   You can even add one of the template variables that are available. Press Ctrl+Space in the **URL** field to see the available variables. By adding template variables to your panel ink, the link sends the user to the right context, with the relevant variables already set.

### Update or delete a panel link

On the panel settings General tab, in the Panel links section, find the panel link that you want to make changes to or delete. Make any necessary changes, or click the **X** to the right of the title to delete the link.
