---
aliases:
  - ../../reference/annotations/
  - ../annotations/
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
refs:
  data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/
  annotations-api:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/annotations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/developer-resources/api-reference/http-api/annotations/
---

# Annotate visualizations

Annotations provide a way to mark points on a visualization with rich events. They are visualized as vertical lines and icons on all graph panels. When you hover over an annotation, you can get event description and event tags. The text field can include links to other systems with more detail.

{{< figure src="/static/img/docs/v46/annotations.png" max-width="800px" alt="Annotated visualization with annotation context menu open" >}}

You can annotate visualizations in three ways:

- Directly in the panel, using the [built-in annotations query](#built-in-query)
- Using the HTTP API
- Configuring annotation queries in the dashboard settings

In the first two cases, you're creating new annotations, while in the last you're querying existing annotations from data sources. The built-in annotation query also supports this.

This page explains the first and third options; for information about using the HTTP API, refer to [Annotations API](ref:annotations-api).

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
1. Click **Edit** in the top-right corner of the dashboard.
1. Click the panel to which you're adding the annotation.

   A context menu appears.

1. In the context menu, click **Add annotation**.
   ![Add annotation context menu](/static/img/docs/time-series-panel/time-series-annotations-context-menu.png)
1. Add an annotation description and tags (optional).
1. Click **Save dashboard**.
1. Click **Exit edit**.

Alternatively, to add an annotation, press Ctrl/Cmd and click the panel, and the **Add annotation** context menu appears.

### Add a region annotation

1. If you've just saved a dashboard, refresh the page.
1. Click **Edit** in the top-right corner of the dashboard.
1. Press Ctrl/Cmd and click and drag on the panel.
   ![Add annotation popover](/static/img/docs/time-series-panel/time-series-annotations-add-region-annotation.gif)
1. Add an annotation description and tags (optional).
1. Click **Save dashboard**.
1. Click **Exit edit**.

### Edit an annotation

1. Click **Edit** in the top-right corner of the dashboard.
1. Hover over the annotation indicator on the panel.
1. Click the pencil icon in the annotation tooltip.
1. Modify the description and tags.
1. Click **Save dashboard**.
1. Click **Exit edit**.

### Delete an annotation

1. Click **Edit** in the top-right corner of the dashboard.
1. Hover over the annotation indicator on the panel.
1. Click the trash icon in the annotation tooltip.
1. Click **Save dashboard**.
1. Click **Exit edit**.

## Fetch annotations through dashboard settings

In the dashboard settings, under **Annotations**, you can add new queries to fetch annotations using any data source, including the built-in data annotation data source. Annotation queries return events that can be visualized as event markers in graphs across the dashboard.

Check out the video below for a quick tutorial.

{{< youtube id="2istdJpPj2Y" >}}

### Add new annotation queries

To add a new annotation query to a dashboard, follow these steps:

1. Click **Edit** in the top-right corner of the dashboard.
1. Click **Settings**.
1. On the **Settings** page, go to the **Annotations** tab.
1. Click **Add annotation query**.

   If you've added a query before, the **+ New query** button is displayed.

1. Enter a name for the annotation query.

   This name is given to the toggle (checkbox) that allows you to enable/disable showing annotation events from this query.

1. Select the data source for the annotations.

   You can also click **Open advanced data source picker** to see more options, including adding a data source (Admins only).

1. If you don't want to use the annotation query right away, clear the **Enabled** checkbox.
1. If you don't want the annotation query toggle to be displayed in the dashboard, select the **Hidden** checkbox.
1. Select a color for the event markers.
1. In the **Show in** drop-down, choose one of the following options:

   - **All panels** - The annotations are displayed on all panels that support annotations.
   - **Selected panels** - The annotations are displayed on all the panels you select.
   - **All panels except** - The annotations are displayed on all panels except the ones you select.

   {{< figure src="/media/docs/grafana/dashboards/screenshot-annotation-filtering-10-v2.png" max-width="600px" caption="Annotation filtering" >}}

1. Configure the query.

   The annotation query options are different for each data source. For information about annotations in a specific data source, refer to the specific [data source](ref:data-source) topic.

1. Click **Save dashboard**.
1. Click **Back to dashboard** and **Exit edit**.

## Built-in query

After you add an annotation, they are still visible. This is due to the built-in annotation query that exists on all dashboards. This annotation query fetches all annotation events that originate from the current dashboard, which are stored in Grafana, and show them on the panel where they were created. This includes alert state history annotations.

By default, the built-in annotation query uses the `-- Grafana --` special data source, and manual annotations are only supported using this data source. You can use another data source in the built-in annotation query, but you'll only be able to create automated annotations using the query editor for that data source.

To add annotations directly to the dashboard, this query must be enabled.

To confirm if the built-in query is enabled, take the following steps:

1. Click **Edit** in the top-right corner of the dashboard.
1. Click **Settings**.
1. On the **Settings** page, go to the **Annotations** tab.
1. Find the **Annotations & Alerts (Built-in)** query.

   If it says **Disabled** before the name of the query, then you'll need to click the query name to open it and update the setting.

You can stop annotations from being fetched and drawn by taking the following steps:

1. Click the dashboard settings (gear) icon in the dashboard header to open the settings menu.
1. Click **Annotations**.
1. Find and click the **Annotations & Alerts (Built-in)** query to open it.
1. Click the **Enabled** toggle to turn it off.
1. Click **Save dashboard**.
1. Click **Back to dashboard** and **Exit edit**.

When you copy a dashboard using the **Save As** feature it gets a new dashboard id, so annotations created on the source dashboard is no longer be visible on the copy. You can still show them if you add a new **Annotation Query** and filter by tags. However, this only works if the annotations on the source dashboard had tags to filter by.

Following are some query options specific to the built-in annotation query.

### Filter queries by tag

You can create new queries to fetch annotations from the built-in annotation query using the `-- Grafana --` data source by setting _Filter by_ to `Tags`.

Grafana also supports typeahead of existing tags, provide at least one tag.

For example, create an annotation query name `outages` and specify a tag `outage`. This query shows all annotations (from any dashboard or via API) with the `outage` tag. If multiple tags are defined in an annotation query, then Grafana only shows annotations matching all the tags. To modify the behavior, enable `Match any`, and Grafana shows annotations that contain any one of the tags you provided.

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
