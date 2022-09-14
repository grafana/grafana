---
aliases:
  - /docs/grafana/latest/best-practices/best-practices-for-creating-dashboards/
description: Best practices for creating dashboards in Grafana
title: Best practices for creating dashboards
weight: 100
---

# Best practices for creating dashboards

This page outlines some best practices to follow when creating Grafana dashboards.

## Before you begin

Here are some principles to consider before you create a dashboard.

### A dashboard should tell a story or answer a question

What story are you trying to tell with your dashboard? Try to create a logical progression of data, such as large to small or general to specific. What is the goal for this dashboard? (Hint: If the dashboard doesn't have a goal, then ask yourself if you really need the dashboard.)

Keep your graphs simple and focused on answering the question that you are asking. For example, if your question is "which servers are in trouble?", then maybe you don't need to show all the server data. Just show data for the ones in trouble.

### Dashboards should reduce cognitive load, not add to it

_Cognitive load_ is basically how hard you need to think about something in order to figure it out. Make your dashboard easy to interpret. Other users and future you (when you're trying to figure out what broke at 2AM) will appreciate it.

Ask yourself:

- Can I tell what exactly each graph represents? Is it obvious, or do I have to think about it?
- If I show this to someone else, how long will it take them to figure it out? Will they get lost?

### Have a monitoring strategy

It's easy to make new dashboards. It's harder to optimize dashboard creation and adhere to a plan, but it's worth it. This strategy should govern both your overall dashboard scheme and enforce consistency in individual dashboard design.

Refer to [Common observability strategies]({{< relref "common-observability-strategies/" >}}) and [Dashboard management maturity levels]({{< relref "dashboard-management-maturity-levels/" >}}) for more information.

### Write it down

Once you have a strategy or design guidelines, write them down to help maintain consistency over time. Check out this [Wikimedia runbook example](https://wikitech.wikimedia.org/wiki/Performance/Runbook/Grafana_best_practices).

## Best practices to follow

- When creating a new dashboard, make sure it has a meaningful name.
  - If you are creating a dashboard to play or experiment, then put the word `TEST` or `TMP` in the name.
  - Consider including your name or initials in the dashboard name or as a tag so that people know who owns the dashboard.
  - Remove temporary experiment dashboards when you are done with them.
- If you create many related dashboards, think about how to cross-reference them for easy navigation. Refer to [Best practices for managing dashboards]({{< relref "best-practices-for-managing-dashboards/" >}}) for more information.
- Grafana retrieves data from a data source. A basic understanding of [data sources]({{< relref "../datasources/" >}}) in general and your specific is important.
- Avoid unnecessary dashboard refreshing to reduce the load on the network or backend. For example, if your data changes every hour, then you don't need to set the dashboard refresh rate to 30 seconds.
- Use the left and right Y-axes when displaying time series with different units or ranges.
- Add documentation to dashboards and panels.
  - To add documentation to a dashboard, add a [Text panel visualization]({{< relref "../visualizations/text-panel/" >}}) to the dashboard. Record things like the purpose of the dashboard, useful resource links, and any instructions users might need to interact with the dashboard. Check out this [Wikimedia example](https://grafana.wikimedia.org/d/000000066/resourceloader?orgId=1).
  - To add documentation to a panel, edit the panel settings and add a description. Any text you add will appear if you hover your cursor over the small `i` in the top left corner of the panel.
- Reuse your dashboards and enforce consistency by using [templates and variables]({{< relref "../dashboards/variables" >}}).
- Be careful with stacking graph data. The visualizations can be misleading, and hide important data. We recommend turning it off in most cases.
