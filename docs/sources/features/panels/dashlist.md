+++
title = "Dashboard List"
keywords = ["grafana", "dashboard list", "documentation", "panel", "dashlist"]
type = "docs"
aliases = ["/docs/grafana/latest/reference/dashlist/"]
[menu.docs]
name = "Dashboard list"
parent = "panels"
weight = 4
+++


# Dashboard List Panel

{{< docs-imagebox img="/img/docs/v45/dashboard-list-panels.png" max-width="850px">}}

The dashboard list panel allows you to display dynamic links to other dashboards. The list can be configured to use starred dashboards, recently viewed dashboards, a search query and/or dashboard tags.

> On each dashboard load, the dashlist panel will re-query the dashboard list, always providing the most up to date results.

## Dashboard List Options

{{< docs-imagebox img="/img/docs/v45/dashboard-list-options.png" class="docs-image--no-shadow docs-image--right">}}

1. **Starred**: The starred dashboard selection displays starred dashboards in alphabetical order.
2. **Recently Viewed**: The recently viewed dashboard selection displays recently viewed dashboards in alphabetical order.
3. **Search**: The search dashboard selection displays dashboards by search query or tag(s).
4. **Show Headings**: When show headings is ticked the chosen list selection(Starred, Recently Viewed, Search) is shown as a heading.
5. **Max Items**: Max items set the maximum of items in a list.
6. **Query**: Here is where you enter your query you want to search by. Queries are case-insensitive, and partial values are accepted.
7. **Tags**: Here is where you enter your tag(s) you want to search by. Note that existing tags will not appear as you type, and *are* case sensitive. To see a list of existing tags, you can always return to the dashboard, open the Dashboard Picker at the top and click `tags` link in the search bar.

<div class="clearfix"></div>

> When multiple tags and strings appear, the dashboard list will display those matching ALL conditions.




