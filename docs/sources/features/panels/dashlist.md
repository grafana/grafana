+++
title = "Dashboard List"
keywords = ["grafana", "dashboard list", "documentation", "panel", "dashlist"]
type = "docs"
aliases = ["/reference/dashlist/"]
[menu.docs]
name = "Dashboard list"
parent = "panels"
weight = 4
+++


# Dashboard List Panel

<img class="no-shadow" src="/img/docs/v45/dashboard-list-panels.png">

The dashboard list panel allows you to display dynamic links to other dashboards. The list can be configured to use starred dashboards, recently viewed dashboards, a search query and/or dashboard tags.

> On each dashboard load, the dashlist panel will re-query the dashboard list, always providing the most up to date results.

## Dashboard List Options

{{< docs-imagebox img="/img/docs/v45/dashboard-list-options.png" max-width="600px" class="docs-image--no-shadow">}}

1. `Starred`: The starred dashboard selection displays starred dashboards in alphabetical order. On dashboard load, the dashlist panel will re-query the favorites to appear in dashboard list panel, always providing the most up to date results.
2. `Recently Viewed`: The recently viewed dashboard selection displays starred dashboards in alphabetical order. On dashboard load, the dashlist panel will re-query the favorites to appear in dashboard list panel, always providing the most up to date results.
3. `Search`: The search dashboard selection displays dashboards by search query or tag(s). On dashboard load, the dashlist panel will re-query the dashboard list, always providing the most up to date results.
4. `Show Headings`: When show headings is ticked the choosen list selection is shown as a heading.
5. `Max Items`: Max items set the maximum of items in a list.
6. `Query`: Here is where you enter your query you want to search by. Remember that you need you have the `Search` checkbox ticked.
7. `Tags`: Here is where you enter your tag(s) you want to search by. Remember that you need you have the `Search` checkbox ticked.

<img class="no-shadow" src="/img/docs/v2/dashboard_list_config_starred.png">


## Mode: Search Dashboards

The panel may be configured to search by either string query or tag(s). On dashboard load, the dashlist panel will re-query the dashboard list, always providing the most up to date results.

To configure dashboard list in this manner, select `search` from the Mode select box. When selected, the Search Options section will appear.


Name | Description
------------ | -------------
Mode | Set search or starred mode
Query | If in search mode specify the search query
Tags | if in search mode specify dashboard tags to search for
Limit number to | Specify the maximum number of dashboards


### Search by string

To search by a string, enter a search query in the `Search Options: Query` field. Queries are case-insensitive, and partial values are accepted.
<img class="no-shadow" src="/img/docs/v2/dashboard_list_config_string.png">

### Search by tag
To search by one or more tags, enter your selection in the `Search Options: Tags:` field. Note that existing tags will not appear as you type, and *are* case sensitive. To see a list of existing tags, you can always return to the dashboard, open the Dashboard Picker at the top and click `tags` link in the search bar.
<img class="no-shadow" src="/img/docs/v2/dashboard_list_config_tags.png">

> When multiple tags and strings appear, the dashboard list will display those matching ALL conditions.




