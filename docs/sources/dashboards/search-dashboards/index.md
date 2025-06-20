---
description: Learn how to search for Grafana dashboards and folders
keywords:
  - search
  - dashboard
  - folder
labels:
  products:
    - cloud
    - enterprise
    - oss
menutitle: Search dashboards
title: Search dashboards and folders
weight: 400
refs:
  service-accounts:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/service-accounts/
  config-file:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#configuration-file-location
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#configuration-file-location
  feature-toggles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles
---

# Search dashboards and folders

You can search for dashboards and dashboard folders by name.

When you search for dashboards, you can also do it by panel title. Whether you search by name or panel title, the system returns all dashboards available within the Grafana instance, even if you do not have permission to view the contents of the dashboard.

## Search by name

Begin typing any part of the dashboard or folder name in the search bar. The search returns results for any partial string match in real-time, as you type.

The search is:

- Real-time
- _Not_ case sensitive
- Functional across stored _and_ file based dashboards and folders.

{{< admonition type="note" >}}
You can use your keyboard arrow keys to navigate the results and press `Enter` to open the selected dashboard or folder.
{{< /admonition >}}

The following images show:

Searching by dashboard name from the **Dashboards** page.

{{< figure src="/media/docs/grafana/dashboards/search-for-dashboard.png" width="700px" >}}

Searching by folder name from the **Dashboards** page.

{{< figure src="/media/docs/grafana/dashboards/search-folder.png" width="700px" >}}

Searching by dashboard name inside a folder.

{{< figure src="/media/docs/grafana/dashboards/search-in-folder.png" width="700px" >}}

{{< admonition type="note" >}}
When you search within a folder, its subfolders are not part of the results returned. You need to be on the **Dashboards** page (or the root level) to search for subfolders by name.
{{< /admonition >}}

## Search dashboards using panel title

You can search for a dashboard by the title of a panel that appears in a dashboard.
If a panel's title matches your search query, the dashboard appears in the search results.

This feature is available by default in Grafana Cloud and in Grafana OSS v9.1 and higher, you access this feature by enabling the `panelTitleSearch` feature toggle.
For more information about enabling panel title search, refer to [Enable the panelTitleSearch feature toggle.](#enable-the-paneltitlesearch-feature-toggle)

The following image shows the search results when you search using panel title.

{{< figure src="/static/img/docs/v91/dashboard-features/search-by-panel-title.png" width="700px" >}}

### Enable the panelTitleSearch feature toggle

Complete the following steps to enable the `panelTitleSearch` feature toggle.

**Before you begin:**

- If you are running Grafana Enterprise with RBAC, enable [service accounts](ref:service-accounts).

**To enable the panelTitleSearch feature toggle:**

1. Open the Grafana [configuration file](ref:config-file).

1. Locate the [feature_toggles](ref:feature-toggles) section.

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

{{< admonition type="note" >}}
When using only a keyboard, press the `tab` key and navigate to the **Filter by tag** drop-down menu, press the down arrow key `▼` to activate the menu and locate a tag, and press `Enter` to select the tag.
{{< /admonition >}}
