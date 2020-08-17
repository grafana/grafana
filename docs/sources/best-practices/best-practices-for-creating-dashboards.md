+++
title = "Best practices for creating dashboards"
description = "Best practices for creating dashboards in Grafana"
type = "docs"
[menu.docs]
weight = 200
+++

# Best practices for creating dashboards

1. When creating a new dashboard, make sure it has a meaningful name.
    - If you are creating a dashboard to play/experiment with it is
      good to put the word `TEST` in the name and, optionally, your
      name so that people know who owns the dashboard.  You should remove it when done.
2. Typically one will create many related dashboards.
   You should cross-reference them for easy navigation. Read the
   [managing a collection of dashboards](#managing-a-collection-of-dashboards) information.
3. Grafana retrieves data from MetricTank.  A basic understanding of
   [MetricTank](#what-is-metrictank-and-graphite) is important.
5. MetricTank supports a Graphite interface.  The most important
   Graphite functions are supported natively by MetricTank and you should familiarize
   yourself with the [function documentation](../metrictank_funcs.md).
5. [Rollups and run-time consolidation](#rollups-and-selecting-the-runtime-consolidation-function)
   are critical concepts.  You need to understand them so that your dashboards
   work correctly with large numbers of timeseries or time ranges.
6. You can optimize dashboard panels that have many
   queries by [using wildcards](#avoiding-many-queries-by-using-wildcards)
7. Avoid unnecessary [dashboard refreshing](#dashboard-refreshing)
   to reduce the load on the GUTS backend.
8. Use the left and right Y axis when displaying timeseries with different
   ranges. 
9. You should [sort values](#how-do-i-sort-the-values-on-a-graph) on a graph to facilitate readability.
10. You should [sort labels](#how-do-i-sort-labels) for readability and consistency across panels.
11. [Aliasing](#how-can-i-modify-the-metric-name-in-my-tables-or-charts) can make your labels readable.
12. Add documentation to panels - Grafana dashboards are great
    in many ways.  It allows one to visualize data in ways that
    allows one to see problems quickly.  However interpreting the
    meaning of a dashboard which you didn't write or don't have
    intimate knowledge of the underlying data is not easy.
    To remedy this you should add documentation to the panels of
    all our key dashboards.  If you mouse over the small `i` in the top
    left corner of the panel, you will see a popup of help text.
13. [Template variables](#template-variables) are a powerful way for
    you to allow a user to customize/control what is displayed on
    the dashboard.  It is very important to understand how to use them.
