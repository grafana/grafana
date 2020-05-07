+++
title = "Add navigation links"
description = ""
keywords = ["grafana", "linking", "create links", "link panels", "link dashboards", "navigate"]
type = "docs"
aliases = ["/docs/grafana/latest/features/navigation-links/"]
[menu.docs]
identifier = "dashboards"
parent = "features"
weight = 1
+++

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
