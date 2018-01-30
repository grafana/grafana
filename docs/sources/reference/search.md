+++
title = "Search"
keywords = ["grafana", "dashboard", "documentation", "search"]
type = "docs"
[menu.docs]
parent = "dashboard_features"
weight = 5
+++


# Dashboard Search

Dashboards can be searched by the dashboard name, filtered by one (or many) tags or filtered by starred status. The dashboard search is accessed through the dashboard picker, available in the dashboard top nav area.

<img class="no-shadow" src="/img/docs/v50/dashboard_search_annotated.png">

1. `Search Bar`: The search bar allows you to enter any string and search both database and file based dashboards in real-time.
2. `Starred`: Here you find all your starred dashboards.
3. `Recent`: Here you find the latest created dashboards.
4. `Folders`: The tags filter allows you to filter the list by dashboard tags.
5. `Root`: The root contains all dashboards that are not placed in a folder.
6. `Tags`: The tags filter allows you to filter the list by dashboard tags.

When using only a keyboard, you can use your keyboard arrow keys to navigate the results, hit enter to open the selected dashboard.

## Find by dashboard name

<img class="no-shadow" src="/img/docs/v50/dashboard_search_text.gif" max-width="800px">

To search and load dashboards click the open folder icon in the header or use the shortcut `CTRL`+`F`. Begin typing any part of the desired dashboard names. Search will return results for for any partial string match in real-time, as you type.

Dashboard search is:
- Real-time
- *Not* case sensitive
- Functional across stored *and* file based dashboards.

## Filter by Tag(s)

Tags are a great way to organize your dashboards, especially as the number of dashboards grow. Tags can be added and managed in the dashboard `Settings`.

To filter the dashboard list by tag, click on any tag appearing in the right column. The list may be further filtered by clicking on additional tags:

<img class="no-shadow" src="/img/docs/v50/dashboard_search_tag_filtering.gif" max-width="800px">

Alternately, to see a list of all available tags, click the tags link in the search bar. All tags will be shown, and when a tag is selected, the dashboard search will be instantly filtered:

<img class="no-shadow" src="/img/docs/v50/dashboard_search_tags_all_filtering.gif" max-width="800px">

<img class="no-shadow" src="/img/docs/v50/tagdropdown2.gif" max-width="800px">

<img class="no-shadow" src="/img/docs/v50/tagdropdown3.gif" max-width="800px">

<img class="no-shadow" src="/img/docs/v50/tagdropdown4.gif" max-width="800px">

When using only a keyboard: `tab` to focus on the *tags* link, `▼` down arrow key to find a tag and select with the `Enter` key.

**Note**: When multiple tags are selected, Grafana will show dashboards that include **all**.


<!-- ## Filter by Starred

Starring is a great way to organize and find commonly used dashboards. To show only starred dashboards in the list, click the *starred* link in the search bar:

<img class="no-shadow" src="/img/docs/v2/dashboard_search_starred_filtering.gif">

When using only a keyboard: `tab` to focus on the *stars* link, `▼` down arrow key to find a tag and select with the `Enter` key. -->
