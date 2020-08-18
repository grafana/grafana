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

### Have a dashboarding strategy

It's easy to make new dashboards. It's harder to optimize dashboard creation and adhere to a plan, but it's worth it. This strategy should govern both your overall dashboard scheme and enforce consistency in individual dashboard design.

Refer to [Dashboard strategies](link) and [Dashboard management maturity levels]({{< relref "dashboard-management-maturity-levels.md" >}}) for more information.

## Best practices

- When creating a new dashboard, make sure it has a meaningful name.
  - If you are creating a dashboard to play or experiment, then put the word `TEST` in the name.
  - Consider including your name or initials in the dashboard name so that people know who owns the dashboard.
  - Remove temporary experiment dashboards when you should remove are done with them.
- If you create many related dashboards, think about how to cross-reference them for easy navigation. Refer to [Best practices for managing dashboards]({{< relref "best-practices-for-managing-dashboards.md" >}}) for more information.
- Grafana retrieves data from a data source. A basic understanding of [data sources]({{< relref "../features/datasources/data-sources.md" >}}) in general and your specific is important.
3. You can optimize dashboard panels that have many
   queries by [using wildcards](#avoiding-many-queries-by-using-wildcards)
4. Avoid unnecessary [dashboard refreshing](#dashboard-refreshing)
   to reduce the load on the network or backend.
5. Use the left and right Y axis when displaying timeseries with different ranges. 
6. You should [sort values](#how-do-i-sort-the-values-on-a-graph) on a graph to facilitate readability.
7. You should [sort labels](#how-do-i-sort-labels) for readability and consistency across panels.
8.  [Aliasing](#how-can-i-modify-the-metric-name-in-my-tables-or-charts) can make your labels readable.
9.  Add documentation to panels - Grafana dashboards are great
    in many ways.  It allows one to visualize data in ways that
    allows one to see problems quickly.  However interpreting the
    meaning of a dashboard which you didn't write or don't have
    intimate knowledge of the underlying data is not easy.
    To remedy this you should add documentation to the panels of
    all our key dashboards.  If you mouse over the small `i` in the top
    left corner of the panel, you will see a popup of help text.
10. [Template variables](#template-variables) are a powerful way for
    you to allow a user to customize/control what is displayed on
    the dashboard.  It is very important to understand how to use them.
11. A dashboard should tell a story.
12. Avoid "dashboard sprawl." Dashboard sprawl negatively affects time to find the right dashboard. Duplicating dashboards and changing “one thing” (worse: keeping original tags) is the easiest kind of sprawl
13. Your dashboarding practices should reduce cognitive load, not add to it.
