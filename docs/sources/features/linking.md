+++
title = "Linking"
description = ""
keywords = ["grafana", "linking", "create links", "link panels", "link dashboards"]
type = "docs"
[menu.docs]
parent = "features"
weight = 9
+++

# Linking 

You can use links to navigate between commonly used dashboards. Links let you create shortcuts to other dashboards, panels, and even external websites.

Grafana supports three types of links: Dashboard Links, Panel Links, and Data Links. They are all available from your dashboard.

{{< docs-imagebox img="/static/assets/img/blog/dashboard_links.png" max-width="800px" caption="Links Supported in Grafana" >}}

## Which link should you use?

Start by figuring out how you're currently navigating between dashboards. If you're often jumping between a set dashboards and struggling to find the same context in each, links can help you optimize your workflow. 

The next step is to figure out which link type is right for your workflow. Even though all the link types in Grafana are used to create shortcuts to other dashboards or external websites, they work in different contexts.

- If the link relates to most if not all of the panels in the dashboard, use a Dashboard Link.
- If you want to drill down into specific panels, use a Panel Link.
- If you want to drill down into a specific series, or even a single measurement, use a Data Link.





## Dashboard Links

Imagine you have a dashboard displaying HTTP request rates and errors for your services. You've zoomed in on an interval with several errors, and you suspect it's related to the underlying hardware. Using Dashboard Links, you can create a shortcut to a dashboard displaying resource usage for the host machines where the service is running.

When you create a Dashboard Link, you have the option to include the time range and current template variables to directly jump to the same context in another dashboard. This way, you don’t have to worry whether you’re looking at the right data.

They can also be used as shortcuts to external systems, such as submitting [a GitHub issue with the current dashboard name](https://github.com/grafana/grafana/issues/new?title=Dashboard%3A%20HTTP%20Requests).

To add a Dashboard Link, go to **Dashboard settings** -> **Links**, and click **New**. Once you've added a Dashboard Link, it will appear in the upper right corner of your dashboard.

{{< docs-imagebox img="/static/assets/img/blog/dashboard_links2.png" max-width="800px" caption="Add Dashboard Link" >}}

To see an example of Dashboard Links in action, check out [this demo](https://play.grafana.org/d/rUpVRdamz/dashboard-links-with-variables?orgId=1).

## Panel Links

Often, Dashboard Links are all you need for linking between dashboards. But imagine that you have a high-level dashboard with several panels representing different systems, and you want to link to separate dashboards for each system. With Dashboard Links, it's not always obvious which link to click to drill down into that service. Instead, use Panel Links to create a link from a specific panel. That way, it's easier to find the drill-down link for that system. 

Each panel can have its own set of links that will appear in the upper left corner of your panel. To add a Panel Link, open the **General** tab in the panel settings and find the Panel Links section.

{{< docs-imagebox img="/static/assets/img/blog/dashboard_links3.png" max-width="800px" caption="Add Panel Link" >}}

You can even add one of the template variables that are available. Press **Ctrl + Space** in the **URL** field to see the available variables. By adding template variables to your Panel Link, the link sends the user to the right context, with the relevant variables already set. You can even [control the time range](https://grafana.com/docs/grafana/latest/reference/timerange/#controlling-time-range-using-url) to ensure the user is zoomed in on the right data.

To see an example of Panel Links in action, check out [this demo](https://play.grafana.org/d/000000156/dashboard-with-panel-link?orgId=1).

## Data Links

Data Links, which [were recently added to Grafana](https://grafana.com/blog/2019/08/27/new-in-grafana-6.3-easy-to-use-data-links/), allow you to provide even more granular context to your links. You can create links that include the series name or even the value under the cursor. Currently, Data Links are only supported in the Graph, Gauge, and Bar Gauge visualizations.

To add a Data Link, go to the **Visualization** tab in the panel settings, and find the **Data Links** section. Click on a point in your graph to access your Data Links. Your links appear in the context menu.

{{< docs-imagebox img="/static/assets/img/blog/dashboard_links4.png" max-width="800px" caption="Add Data Link" >}}

To see an example of Data Links in action, check out [this demo](https://play.grafana.org/d/ZvPm55mWk/new-features-in-v6-3?orgId=1&fullscreen&panelId=27). Refer to the [documentation](https://grafana.com/docs/grafana/latest/features/panels/graph/#data-link) for more information on Data Links.