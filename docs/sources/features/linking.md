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

