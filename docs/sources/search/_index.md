---
description: Learn how to search for Grafana dashboards
keywords:
  - search
  - dashboard
menutitle: Search
title: Search
weight: 80
---

# Search dashboards

You can search for dashboards by dashboard name and by panel title. When you search for dashboards, the system returns all dashboards available within the Grafana instance, even if you do not have permission to view the contents of the dashboard.

## Search dashboards using dashboard name

Begin typing any part of the dashboard name in the search bar. The search returns results for any partial string match in real-time, as you type.

Dashboard search is:

- Real-time
- _Not_ case sensitive
- Functional across stored _and_ file based dashboards.

{{% admonition type="note" %}}
You can use your keyboard arrow keys to navigate the results and press `Enter` to open the selected dashboard.
{{% /admonition %}}

The following image shows the search results when you search using dashboard name.

{{< figure src="/static/img/docs/v91/dashboard-features/search-by-dashboard-name.png" width="700px" >}}

## Search dashboards using panel title

You can search for a dashboard by the title of a panel that appears in a dashboard.
If a panel's title matches your search query, the dashboard appears in the search results.

This feature is available by default in Grafana Cloud and in Grafana OSS v9.1 and higher, you access this feature by enabling the `panelTitleSearch` feature toggle.
For more information about enabling panel title search, refer to [Enable the panelTitleSearch feature toggle.](#enable-panelTitleSearch-feature-toggle)

The following image shows the search results when you search using panel title.

{{< figure src="/static/img/docs/v91/dashboard-features/search-by-panel-title.png" width="700px" >}}

### Enable the panelTitleSearch feature toggle

Complete the following steps to enable the `panelTitleSearch` feature toggle.

**Before you begin:**

- If you are running Grafana Enterprise with RBAC, enable [service accounts]({{< relref "../administration/service-accounts/" >}}).

**To enable the panelTitleSearch feature toggle:**

1. Open the Grafana [configuration file]({{< relref "../setup-grafana/configure-grafana/#configuration-file-location" >}}).

1. Locate the [feature_toggles]({{< relref "../setup-grafana/configure-grafana/#feature_toggles" >}}) section.

1. Add the following parameter to the `feature_toggles` section:

   ```
   [feature_toggles]
   # enable features, separated by spaces
   enable = panelTitleSearch
   ```

1. Save your changes and restart the Grafana server.

## Filter dashboard search results by tag(s)

Tags are a great way to organize your dashboards, especially as the number of dashboards grow. You can add and manage tags in dashboard `Settings`.

When you select multiple tags, Grafana shows dashboards that include all selected tags.

To filter dashboard search result by a tag, complete one of the following steps:

- To filter dashboard search results by tag, click a tag that appears in the right column of the search results.

  You can continue filtering by clicking additional tags.

- To see a list of all available tags, click the **Filter by tags** dropdown menu and select a tag.

  All tags will be shown, and when you select a tag, the dashboard search will be instantly filtered.

{{% admonition type="note" %}}
When using only a keyboard, press the `tab` key and navigate to the **Filter by tag** drop-down menu, press the down arrow key `▼` to activate the menu and locate a tag, and press `Enter` to select the tag.
{{% /admonition %}}

## Command palette

The command palette enables you to:

- Search for and open dashboards and folders
- Create dashboards and alert rules
- Locate pages within Grafana
- Change the theme to dark or light

![Command Palette screenshot](/media/docs/grafana/CommandPalette_doc_1.png)

To open the command palette, press `cmd+K` in macOS or `ctrl+k` in Linux/Windows. You can also click on the input located in the navigation bar.

> **Note:** To go to the previous step, press `backspace` with the command palette input empty.
