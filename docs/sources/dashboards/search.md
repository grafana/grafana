---
aliases:
  - ../reference/search/
keywords:
  - grafana
  - dashboard
  - documentation
  - search
title: Search
weight: 9
---

# Dashboard Search

Dashboards can be searched by the dashboard name, filtered by one (or many) tags or filtered by starred status. The dashboard search is accessed through the dashboard picker, available in the dashboard top nav area. The dashboard search can also be opened by using the shortcut `F`.

<img class="no-shadow" src="/static/img/docs/v50/dashboard_search_annotated.png" width="700px">

1. `Search Bar`: The search bar allows you to enter any string and search both database and file based dashboards in real-time.
1. `Starred`: Here you find all your starred dashboards.
1. `Recent`: Here you find the latest created dashboards.
1. `Folders`: The tags filter allows you to filter the list by dashboard tags.
1. `Root`: The root contains all dashboards that are not placed in a folder.
1. `Tags`: The tags filter allows you to filter the list by dashboard tags.

When using only a keyboard, you can use your keyboard arrow keys to navigate the results, hit enter to open the selected dashboard.

## Find by dashboard name

Begin typing any part of the desired dashboard names in the search bar. Search will return results for any partial string match in real-time, as you type.

Dashboard search is:

- Real-time
- _Not_ case sensitive
- Functional across stored _and_ file based dashboards.

## Filter by Tag(s)

Tags are a great way to organize your dashboards, especially as the number of dashboards grow. Tags can be added and managed in the dashboard `Settings`.

To filter the dashboard list by tag, click on any tag appearing in the right column. The list may be further filtered by clicking on additional tags:

Alternately, to see a list of all available tags, click the tags dropdown menu. All tags will be shown, and when a tag is selected, the dashboard search will be instantly filtered:

When using only a keyboard: `tab` to focus on the _tags_ link, `▼` down arrow key to find a tag and select with the `Enter` key.

> **Note:** When multiple tags are selected, Grafana will show dashboards that include **all**.
