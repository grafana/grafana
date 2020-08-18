+++
title = "Best practices for creating dashboards"
description = "Best practices for creating dashboards in Grafana"
type = "docs"
[menu.docs]
weight = 200
+++

# Best practices for creating dashboards

This page outlines some best practices to adhere to when creating Grafana dashboards.

## Before you begin

There are three principles to consider before you create a dashboard.

### A dashboard should tell a story

What story are you trying to tell with your dashboard? Try to create a logical progression of data, such as large to small or general to specific.

### Dashboards should reduce cognitive load, not add to it

_Cognitive load_ is basically how hard you need to think about something in order to figure it out. Make your dashboard easy to interpret. Other users and future you (when you're trying to figure out what broke at 2AM) will appreciate it.

### Have a monitoring strategy

It's easy to make new dashboards. It's harder to optimize dashboard creation and adhere to a plan, but it's worth it. This strategy should govern both your overall dashboard scheme and enforce consistency in individual dashboard design.

Refer to [Common observability strategies]({{< relref "common-observability-strategies.md" >}}) and [Dashboard management maturity levels]({{< relref "dashboard-management-maturity-levels.md" >}}) for more information.

## Best practices to follow

- When creating a new dashboard, make sure it has a meaningful name.
  - If you are creating a dashboard to play or experiment, then put the word `TEST` in the name.
  - Consider including your name or initials in the dashboard name so that people know who owns the dashboard.
  - Remove temporary experiment dashboards when you should remove are done with them.
- If you create many related dashboards, think about how to cross-reference them for easy navigation. Refer to [Best practices for managing dashboards]({{< relref "best-practices-for-managing-dashboards.md" >}}) for more information.
- Grafana retrieves data from a data source. A basic understanding of [data sources]({{< relref "../features/datasources/data-sources.md" >}}) in general and your specific is important.
- Avoid unnecessary dashboard refreshing to reduce the load on the network or backend. For example, if your data changes every hour, then you don't need to set the dashboard refresh rate to 30 seconds.
- Use the left and right Y-axes when displaying time series with different ranges. 
-  Add documentation to dashboards and panels.
   - To add documentation to a dashboard, add a [Text panel visualization]({{< relref "../panels/visualizations/text-panel.md" >}}) to the dashboard. Record things like the purpose of the dashboard, useful resource links, and any instructions users might need to interact with the dashboard. Check out this [Wikimedia example](https://grafana.wikimedia.org/d/000000066/resourceloader?orgId=1).
   - To add documentation to a panel, [edit the panel settings]({{< relref "../panels/add-a-panel.md#edit-panel-settings" >}}) and add a description. Any text you add will appear if you hover your cursor over the small `i` in the top left corner of the panel.
-  Reuse your dashboards and enforce consistency by using [templates and variables]({{< relref "../variables/templates-and-variables.md" >}}).
