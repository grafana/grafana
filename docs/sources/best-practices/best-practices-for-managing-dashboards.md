+++
title = "Best practices for managing dashboards"
description = "Best practices for managing dashboards in Grafana"
type = "docs"
[menu.docs]
weight = 200
+++

# Best practices for managing dashboards

This page outlines some best practices to follow when creating Grafana dashboards.

## Before you begin

Here are some principles to consider before you start managing dashboards.

### Strategic observability

There are several [common observability strategies]({{< relref "common-observability-strategies.md" >}}). You should research them and decide whether one of them works for you or if you want to come up with your own. Either way, have a plan, write it down, and stick to it. 

Adapt your strategy to changing needs as necessary.

### Maturity level

What is your dashboard maturity level? Analyze your current dashboard setup and compare it to the [Dashboard management maturity levels]({{< relref "dashboard-management-maturity-levels.md" >}}). Understanding where you are can help you decide how to get where you want to be.

## Best practices to follow

- Avoid dashboard sprawl.
  - Periodically review the dashboards and remove unnecessary ones.
  - If you create a temporary dashboard, perhaps to test something, append the name with `-TEST`. Delete the dashboard when you are finished.
- Copying dashboards with no significant changes is not a good idea.
   This is especially true for the dashboards maintained by the GUTS team.
   This is a bad idea for several reasons:
    - You miss out on updates to the original dashboard, e.g. documentation
      changes, or bug fixes / additions to metrics.
    - In many cases copies are being made to simply customize the view
      by setting template parameters.  This should instead be done by
      maintaining a link to the master dashboard, see below, and customizing
      the view via URL parameters.
- When you must copy a dashboard, clearly rename it and do not copy the dashboard tags. Tags are important meta-data for dashboards that are
   used during search. Copying tags can result in false matches.
2. Maintaining a dashboard of dashboards, or cross referencing dashboards
   can be done in several ways.
    - Create links at the dashboard level by clicking on the *Settings* gear
      and then the *Links* menu item.  These links are pretty straightforward to
      setup, however the only drawback is that you have no control over the layout.
      They work great when you have a limited number of links, but as your number
      grows it becomes a bit unwieldy.
    - Links at the panel level via [drilldown links](https://grafana.com/docs/features/panels/graph/#drilldown-detail-link).
      These can be nice because you might want different drill-downs on each panel.  However it is not easy for end-users to see these links.
    - Add a [Dashboard List Panel](https://grafana.com/docs/features/panels/dashlist/) - You
      can then customize what you see by doing searches.  Typically one might want to do a
      tag search or folder search.  The [GUTS OS Dashboard]() uses both.
    - Add a [Text Panel](https://grafana.com/docs/features/panels/text/) - and use Markdown to customize the display.
      You can see an example of this on the [Machine View]() Dashboard.
