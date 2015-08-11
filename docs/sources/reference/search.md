----
page_title: Dashboard Search
page_description:  Dashboard Search in Grafana
page_keywords: grafana, search, guide, documentation
---

# Dashboard Search

Dashboards can be searched by the dashboard name, filtered by one (or many) tags or filtered by starred status. The dashboard search is accessed through the dashboard picker, available in the dashboard top nav area.

<img class="no-shadow" src="/img/v2/dashboard_search.png">

1. `Dashboard Picker`: The Dashboard Picker is your primary navigation tool to move between dashboards. It is present on all dashboards, and open the Dashboard Search. The dashboard picker also doubles as the title of the current dashboard.
2. `Search Bar`: The search bar allows you to enter any string and search both database and file based dashbaords in real-time.
3. `Starred`: The starred link allows you to filter the list to display only starred dashboards. 
4. `Tags`: The tags filter allows you to filter the list by dashboard tags. 

When using only a keyboard, you can use your keyboard arrow keys to navigate the results, hit enter to open the selected dashboard.

## Find by dashboard name

<img class="no-shadow" src="/img/v2/dashboard_search_text.gif">

To search and load dashboards click the open folder icon in the header or use the shortcut `CTRL`+`F`. Begin typing any part of the desired dashboard names. Search will return results for for any partial string match in real-time, as you type. 

Dashboard search is:
- Real-time
- *Not* case senstitive
- Functional across stored *and* file based dashboards. 

## Filter by Tag(s)

Tags are a great way to organize your dashboards, especially as the number of dashbaords grow. Tags can be added and managed in the dashboard `Settings`.

To filter the dashboard list by tag, click on any tag appearing in the right column. The list may be further filtered by cliking on additional tags: 

<img class="no-shadow" src="/img/v2/dashboard_search_tag_filtering.gif">

Alternately, to see a list of all available tags, click the tags link in the search bar. All tags will be shown, and when a tag is selected, the dashboard search will be instantly filtered:

<img class="no-shadow" src="/img/v2/dashboard_search_tags_all_filtering.gif">

When using only a keybaord: `tab` to focus on the *tags* link, `▼` down arrow key to find a tag and select with the `Enter` key.

**Note**: When multiple tags are selected, Grafana will show dashboards that include **all**. 


## Filter by Starred

Starring is a great way to organize and find commonly used dashboards. To show only starred dashboards in the list, click the *starred* link in the search bar:

<img class="no-shadow" src="/img/v2/dashboard_search_starred_filtering.gif">

When using only a keybaord: `tab` to focus on the *stars* link, `▼` down arrow key to find a tag and select with the `Enter` key.