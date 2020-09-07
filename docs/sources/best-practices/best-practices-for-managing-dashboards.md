+++
title = "Best practices for managing dashboards"
description = "Best practices for managing dashboards in Grafana"
type = "docs"
[menu.docs]
weight = 200
+++

# Best practices for managing dashboards

This page outlines some best practices to follow when managing Grafana dashboards.

## Before you begin

Here are some principles to consider before you start managing dashboards.

### Strategic observability

There are several [common observability strategies]({{< relref "common-observability-strategies.md" >}}). You should research them and decide whether one of them works for you or if you want to come up with your own. Either way, have a plan, write it down, and stick to it. 

Adapt your strategy to changing needs as necessary.

### Maturity level

What is your dashboard maturity level? Analyze your current dashboard setup and compare it to the [Dashboard management maturity model]({{< relref "dashboard-management-maturity-levels.md" >}}). Understanding where you are can help you decide how to get to where you want to be.

## Best practices to follow

- Avoid dashboard sprawl, meaning the uncontrolled growth of dashboards. Dashboard sprawl negatively affects time to find the right dashboard. Duplicating dashboards and changing “one thing” (worse: keeping original tags) is the easiest kind of sprawl.
  - Periodically review the dashboards and remove unnecessary ones.
  - If you create a temporary dashboard, perhaps to test something, prefix the name with `TEST: `. Delete the dashboard when you are finished.
- Copying dashboards with no significant changes is not a good idea.
  - You miss out on updates to the original dashboard, such as documentation changes, bug fixes, or additions to metrics.
  - In many cases copies are being made to simply customize the view by setting template parameters. This should instead be done by maintaining a link to the master dashboard and customizing the view with [URL parameters]({{< relref "../linking/data-link-variables.md" >}}).
- When you must copy a dashboard, clearly rename it and _do not_ copy the dashboard tags. Tags are important metadata for dashboards that are used during search. Copying tags can result in false matches.
- Maintain a dashboard of dashboards or cross-reference dashboards. This can be done in several ways:
    - Create dashboard links, panel, or data links. Links can go to other dashboards or to external systems. For more information, refer to [Linking]({{< relref "../linking/_index.md" >}}).
    - Add a [Dashboard list panel]({{< relref "../panels/visualizations/dashboard-list-panel.md" >}}). You can then customize what you see by doing tag or folder searches.
    - Add a [Text panel]({{< relref "../panels/visualizations/text-panel.md" >}}) and use markdown to customize the display.
