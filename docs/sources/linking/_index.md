+++
title = "Linking"
type = "docs"
[menu.docs]
identifier = "linking"
weight = 100
+++

# Linking overview

You can use links to navigate between commonly-used dashboards or to connect others to your visualizations. Links let you create shortcuts to other dashboards, panels, and even external websites.

Grafana supports dashboard links, panel links, and data links. Dashboard links are displayed at the top of the dashboard. Panel links are accessible by clicking an icon on the top left corner of the panel.

## Which link should you use?

Start by figuring out how you're currently navigating between dashboards. If you're often jumping between a set of dashboards and struggling to find the same context in each, links can help optimize your workflow.

The next step is to figure out which link type is right for your workflow. Even though all the link types in Grafana are used to create shortcuts to other dashboards or external websites, they work in different contexts.

- If the link relates to most if not all of the panels in the dashboard, use [dashboard links]({{< relref "dashboard-links.md" >}}).
- If you want to drill down into specific panels, use [panel links]({{< relref "panel-links.md" >}}).
- If you want to link to an external site, you can use either a dashboard link or a panel link.
- If you want to drill down into a specific series, or even a single measurement, use [data links]({{< relref "data-links.md" >}}).

## Controlling time range using the URL

You can control the time range of a panel or dashboard by providing following query parameters in dashboard URL:

- `from` - defines lower limit of the time range, specified in ms epoch
- `to` - defines upper limit of the time range, specified in ms epoch
- `time` and `time.window` - defines a time range from `time-time.window/2` to `time+time.window/2`. Both params should be specified in ms. For example `?time=1500000000000&time.window=10000` will result in 10s time range from 1499999995000 to 1500000005000