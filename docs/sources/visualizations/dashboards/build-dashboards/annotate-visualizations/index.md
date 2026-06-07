---
aliases:
  - ../../../dashboards/annotations/ # /docs/grafana/next/annotations/
  - ../../../dashboards/build-dashboards/annotate-visualizations/ # /docs/grafana/next/dashboards/build-dashboards/annotate-visualizations/
  - ../../../panels/visualizations/annotations/ # /docs/grafana/next/panels/visualizations/annotations/
  - ../../../reference/annotations/ # /docs/grafana/latest/reference/annotations/
keywords:
  - grafana
  - annotations
  - documentation
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Annotate visualizations
title: Annotate visualizations
weight: 600
description: Annotate dashboard visualizations to mark points with rich events
---

# Annotate visualizations

Annotations provide a way to mark points on a visualization with rich events. They are visualized as vertical lines and icons on all graph panels. When you hover over an annotation, you can get event description and event tags. The text field can include links to other systems with more detail.

{{< figure src="/static/img/docs/v46/annotations.png" max-width="800px" alt="Annotated visualization with annotation context menu open" >}}

You can annotate visualizations in three ways:

- Directly in the panel, using the [built-in annotations query](#built-in-query)
- Using the HTTP API
- Configuring annotation queries in the dashboard settings

In the first two cases, you're creating new annotations, while in the last you're querying existing annotations from data sources. The built-in annotation query also supports this.

This page explains the first and third options; for information about using the HTTP API, refer to [Annotations API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/annotations/).

Annotations are supported for the following visualization types:

- Time series
- State timeline
- Candlestick

## Create annotations in panels

Grafana comes with the ability to add annotation events directly from a panel using the [built-in annotation query](#built-in-query) that exists on all dashboards. Annotations that you create this way are stored in Grafana.

To add annotations directly in the panel:

- The dashboard must already be saved.
- The built-in query must be enabled. Learn more in [Built-in query](#built-in-query).

Watch the following video for a quick tutorial on creating annotations:

{{< youtube id="N5iOlyYyK6Q" >}}

### Add an annotation

To add an annotation, complete the following steps:

1. If you've just saved a dashboard, refresh the page.
1. Click a data point in a panel to open the tooltip.
1. In the tooltip, click **Add annotation**.
   ![Add annotation context menu](/static/img/docs/time-series-panel/time-series-annotations-context-menu.png)
1. Add an annotation description and tags (optional).
1. Click **Save**.

Alternatively, to add an annotation, press Ctrl/Cmd and click anywhere on the panel, and the **Add annotation** tooltip appears.

### Add a region annotation

1. If you've just saved a dashboard, refresh the page.
1. Press Ctrl/Cmd and click and drag on the panel to open the **Add annotation** dialog box.
   ![Add annotation dialog box](/static/img/docs/time-series-panel/time-series-annotations-add-region-annotation.gif)
1. Add an annotation description and tags (optional).
1. Click **Save**

### Edit an annotation

1. Hover over the annotation indicator at the bottom of the panel to open the tooltip.
1. Click the pencil icon to open the annotation dialog box.
1. Modify the description and tags.
1. Click **Save**.

### Delete an annotation

1. Hover over the annotation indicator at the bottom of the panel to open the tooltip.
1. Click the trash icon to open the annotation dialog box.

## Annotation queries

You can add new queries to fetch annotations using any data source, including the built-in data annotation data source. Annotation queries return events that can be visualized as event markers in graphs across the dashboard.

Check out the video below for a quick tutorial.

{{< youtube id="2istdJpPj2Y" >}}

### Add annotation queries

To add an annotation query to a dashboard, follow these steps:

{{< docs/list >}}

1. Click **Edit** in the top-right corner of the dashboard.
1. In the toolbar, click the **Dashboard options** icon to open the sidebar.
1. In the sidebar, click **Settings**.
1. On the **Settings** page, go to the **Annotations** tab.
1. Click **Add annotation query**.

   If you've added a query before, the **+ New query** button is displayed.

1. Enter a name for the annotation query.

   This name is given to the toggle that allows you to enable/disable showing annotation events from this query.

1. Select the data source for the annotations.

   You can also click **Open advanced data source picker** to see more options, including adding a data source (Admins only).

{{< shared id="add-annotation-query" >}}

1. If you don't want to use the annotation query right away, clear the **Enabled** checkbox.
1. Select a color for the event markers.
1. Select one of the following options in the **Show annotation controls in** drop-down list to control where annotations are displayed:
   - **Above dashboard** - The annotation toggle is displayed above the dashboard. This is the default.
   - **Controls menu** - The annotation toggle is displayed in the dashboard controls menu instead of above the dashboard. The dashboard controls menu appears as a button in the dashboard toolbar.
   - **Hidden** - The annotation toggle is not displayed on the dashboard.

1. In the **Show in** drop-down, choose one of the following options:
   - **All panels** - The annotations are displayed on all panels that support annotations.
   - **Selected panels** - The annotations are displayed on all the panels you select.
   - **All panels except** - The annotations are displayed on all panels except the ones you select.

   {{< figure src="/media/docs/grafana/dashboards/screenshot-annotation-filtering-10-v2.png" max-width="600px" caption="Annotation filtering" >}}

   {{< /shared >}}

1. To create a query, do one of the following:
   - Write or construct a query in the query language of your data source. The annotation query options are different for each data source. For information about annotations in a specific data source, refer to the specific [data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/) topic.
   - Open the **Saved queries** drop-down menu and click **Replace query** to reuse a [saved query](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/#saved-queries).

1. (Optional) To [save the query](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/#save-a-query) for reuse, open the **Saved queries** drop-down menu and click the **Save query** option.
1. (Optional) Click **Test annotation query** to ensure that the query is working properly.
1. (Optional) To add subsequent queries, click **+ Add query** or **+ Add from saved queries**, and test them as many times as needed.

   {{< admonition type="note" >}}
   [Saved queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/#saved-queries) is currently in [public preview](https://grafana.com/docs/release-life-cycle/) in Grafana Enterprise and Grafana Cloud only.
   {{< /admonition >}}

1. Click **Save**.
1. (Optional) Enter a description of the changes you've made.
1. Click **Save**.
1. Click **Back to dashboard** and **Exit edit**.

{{< /docs/list >}}

{{< admonition type="tip" >}}
To create annotation queries without leaving the dashboard, click the **Add new element** icon in the dashboard toolbar, and select **Annotation query**.
For more information, refer to the [Dashboard controls documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard/dashboard-controls/).
{{< /admonition >}}

## Built-in query

After you add an annotation, they are still visible. This is due to the built-in annotation query that exists on all dashboards. This annotation query fetches all annotation events that originate from the current dashboard, which are stored in Grafana, and show them on the panel where they were created. This includes alert state history annotations.

By default, the built-in annotation query uses the `-- Grafana --` special data source, and manual annotations are only supported using this data source. You can use another data source in the built-in annotation query, but you'll only be able to create automated annotations using the query editor for that data source.

To add annotations directly to the dashboard, this query must be enabled.

To confirm if the built-in query is enabled, take the following steps:

1. Click **Edit** in the top-right corner of the dashboard.
1. Click the **Dashboard options** icon in the toolbar.
1. In the sidebar, click **Settings**.
1. On the **Settings** page, go to the **Annotations** tab.
1. Select the **Annotations & Alerts (Built-in query)**.
1. Check if the **Enabled** checkbox is selected.

   If you don't want annotations to be fetched and drawn, clear the checkbox.

1. Click **Save**.
1. Enter an optional description of your changes and click **Save**.
1. Click **Exit edit**.

When you copy a dashboard using the **Save As** feature it gets a new dashboard id, so annotations created on the source dashboard is no longer be visible on the copy. You can still show them if you add a new **Annotation Query** and filter by tags. However, this only works if the annotations on the source dashboard had tags to filter by.

Following are some query options specific to the built-in annotation query.

### Filter queries by tag

You can create new queries to fetch annotations from the built-in annotation query using the `-- Grafana --` data source by setting _Filter by_ to `Tags`.

Grafana also supports typeahead of existing tags, provide at least one tag.

For example, create an annotation query name `outages` and specify a tag `outage`. This query shows all annotations (from any dashboard or via API) with the `outage` tag. If multiple tags are defined in an annotation query, then Grafana only shows annotations matching all the tags. To modify the behavior, enable `Match any`, and Grafana shows annotations that contain any one of the tags you provided.

{{< admonition type="warning" >}}
If you enable **Display annotations** on an externally shared dashboard that uses tag-based annotation queries, those queries return matching annotations from _all dashboards_ in the organization. This means annotations from dashboards that are not shared externally are visible to anyone with access to the shared dashboard. This is by design. Review which annotations might match your tags before enabling this option on a shared dashboard.
{{< /admonition >}}

{{< figure src="/media/docs/grafana/dashboards/screenshot-annotations-typeahead-support-10.0.png" max-width="600px" alt="Annotation query options" >}}

You can also use template variables in the tag query. This means if you have a dashboard showing stats for different services and a template variable that dictates which services to show, you can use the same template variable in your annotation query to only show annotations for those services.

{{< figure src="/media/docs/grafana/dashboards/screenshot-annotation-tag-filter-variable-10.0.png" max-width="600px" alt="Annotation query options with a template variable query tag" >}}

### Add time regions

When adding or editing an annotation, you can define a repeating time region by setting **Query type** to **Time regions**. Then, define the **From** and **To** sections with the preferred days of the week and time. You also have the option to change the timezone, which is set to the dashboard's timezone, by default.

{{< figure src="/media/docs/grafana/dashboards/screenshot-annotation-timeregions-10-v2.png" max-width="600px" alt="Time regions options set to business hours" >}}

The above configuration produces the following result in the Time series panel:

{{< figure src="/media/docs/grafana/screenshot-grafana-10-0-timeseries-time-regions.png" max-width="600px" alt="Time series visualization with time regions business hours" >}}

Toggle the **Advanced** switch and use [Cron syntax](https://en.wikipedia.org/wiki/Cron) to set more granular time region controls. The following example sets a time region of 9:00 AM, Monday to Friday:

{{< figure src="/media/docs/grafana/dashboards/screenshot-annotations-cron-option-v11.6.png" max-width="600px" alt="Time region query with cron syntax" >}}
