----
page_title: Dashlist Panel
page_description: Dashlist Panel Reference
page_keywords: grafana, dashlist, panel, documentation
---

# Dashlist Panel

## Overview

The dashboard list panel allows you to show a list of links to other dashboards. The list can be based on a search query or dashboard tag query. You can also configure it to show your starred
dashboards.

<img class="no-shadow" src="/img/v2/dashboard_list_panels.png" style="width:80%;">


## Options

### Mode: Starred Dashboards

The `starred` dashboard selection will display starred dashboards in alphabetical order, up to the number selected in the `Limit Number to` field. As new starred dashboards are added, the Dashlist Panel will automatically update.


### Mode: Search Dashboards

Dashboard lists may be configured by either a string search query or tag. On each dashboard load, the dashlist panel will re-query the dashboard list, always providing the most up to date results. 

To configure dashboard list in this manner, select `search` from the Mode select box. When properly selected, the Search Options section will appear.

Name | Description
------------ | -------------
Mode | Set search or starred mode
Query | If in search mode specify the search query
Tags | if in search mode specify dashboard tags to search for
Limit number to | Specify the maximum number of dashboards


#### Search by string
To search by a string, enter a search query in the `Search Options: Query:` field. Queries are non-case sensitive, and partial values are accepted. On each dashboard load, the dashlist panel will re-query the dashboard list, always providing the most up to date results of the search string. 

<img class="no-shadow" src="/img/v2/dashboard_list_config_string.png">

#### Search by tag
To search by a string, enter a search query in the `Search Options: Query:` field. Queries are non-case sensitive, and partial values are accepted. 

<img class="no-shadow" src="/img/v2/dashboard_list_config_tags.png">

When multiple tags and strings appear, the dashboard list will display those matching ALL conditions. 




