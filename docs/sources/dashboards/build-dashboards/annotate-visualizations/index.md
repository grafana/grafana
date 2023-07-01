---
aliases:
  - ../../reference/annotations/
  - ../annotations/
keywords:
  - grafana
  - annotations
  - documentation
  - guide
menuTitle: Annotate visualizations
title: Annotate visualizations
weight: 600
---

# Annotate visualizations

Annotations provide a way to mark points on the graph with rich events. When you hover over an annotation
you can get event description and event tags. The text field can include links to other systems with more detail.

{{< figure src="/static/img/docs/v46/annotations.png" max-width="800px" >}}

## Native annotations

Grafana comes with a native annotation store and the ability to add annotation events directly from the graph panel or via the [HTTP API]({{< relref "../../../developers/http_api/annotations/" >}}).

### Add annotation

1. In the dashboard click on the Time series panel. A context menu will appear.
1. In the context menu click on **Add annotation**.
   ![Add annotation context menu](/static/img/docs/time-series-panel/time-series-annotations-context-menu.png)
1. Add an annotation description and tags(optional).
   ![Add annotation popover](/static/img/docs/time-series-panel/time-series-annotations-add-annotation.png)
1. Click save.

Alternatively, to add an annotation, Ctrl/Cmd+Click on the Time series panel and the Add annotation popover will appear

### Add region annotation

1. In the dashboard Ctrl/Cmd+click and drag on the Time series panel.
   ![Add annotation popover](/static/img/docs/time-series-panel/time-series-annotations-add-region-annotation.gif)
1. Add an annotation description and tags(optional).
1. Click save.

### Edit annotation

1. In the dashboard hover over an annotation indicator on the Time series panel.
   <!--![Add annotation popover](/static/img/docs/time-series-panel/time-series-annotations-edit-annotation.gif)-->
1. Click on the pencil icon in the annotation tooltip.
1. Modify the description and/or tags.
1. Click save.

### Delete annotation

1. In the dashboard hover over an annotation indicator on the Time series panel.
   <!--![Add annotation popover](/static/img/docs/time-series-panel/time-series-annotations-edit-annotation.gif)-->
1. Click on the trash icon in the annotation tooltip.

### Built-in query

After you added an annotation they will still be visible. This is due to the built in annotation query that exists on all dashboards. This annotation query will
fetch all annotation events that originate from the current dashboard and show them on the panel where they were created. This includes alert state history annotations. You can
stop annotations from being fetched and drawn by opening the **Annotations** settings (via Dashboard cogs menu) and modifying the query named `Annotations & Alerts (Built-in)`.

When you copy a dashboard using the **Save As** feature it will get a new dashboard id so annotations created on source dashboard will no longer be visible on the copy. You
can still show them if you add a new **Annotation Query** and filter by tags. But this only works if the annotations on the source dashboard had tags to filter by.

### Query by tag

You can create new queries to fetch annotations from the native annotation store via the `-- Grafana --` data source by setting _Filter by_ to `Tags`.

Grafana v8.1 and later versions also support typeahead of existing tags, provide at least one tag.

For example, create an annotation query name `outages` and specify a tag `outage`. This query will show all annotations (from any dashboard or via API) with the `outage` tag. If multiple tags are defined in an annotation query, then Grafana will only show annotations matching all the tags. To modify the behavior, enable `Match any`, and Grafana will show annotations that contain any one of the tags you provided.

{{< figure src="/static/img/docs/annotations/annotations_typeahead_support-8-1-0.png" max-width="600px" >}}

In Grafana v5.3+ it's possible to use template variables in the tag query. So if you have a dashboard showing stats for different services and a template variable that dictates which services to show, you can now use the same template variable in your annotation query to only show annotations for those services.

{{< figure src="/static/img/docs/annotations/annotation_tag_filter_variable-8-1-0.png" max-width="600px" >}}

### Filter by panel

You can configure the panels to which annotations apply by choosing an option from the **Show in** section. You can select **All panels**, which applies to all panels that support annotations, or filter for specific panels by choosing **Selected panels** or **All panels except**. The annotations are displayed accordingly.

{{< figure src="/media/docs/grafana/dashboards/screenshot-annotation-filtering-10-v2.png" max-width="600px" caption="Annotation filtering" >}}

### Add time region

When adding or editing an annotation, you can define a repeating time region by setting **Query type** to **Time regions**. Then, define the **From** and **To** sections with the preferred days of the week and time. You also have the option to change the timezone, which is set to the dashboard's timezone, by default.

{{< figure src="/media/docs/grafana/dashboards/screenshot-annotation-timeregions-10-v2.png" max-width="600px" caption="Time regions business hours" >}}

The above configuration will produce the following result in the Time series panel:

{{< figure src="/media/docs/grafana/screenshot-grafana-10-0-timeseries-time-regions.png" max-width="600px" caption="Time series time regions business hours" >}}

## Querying other data sources

Annotation events are fetched via annotation queries. To add a new annotation query to a dashboard
open the dashboard settings menu, then select `Annotations`. This will open the dashboard annotations
settings view. To create a new annotation query hit the `New` button.

<!--![](/static/img/docs/v50/annotation_new_query.png)-->

{{< figure src="/static/img/docs/v50/annotation_new_query.png" max-width="600px" >}}

Specify a name for the annotation query. This name is given to the toggle (checkbox) that will allow
you to enable/disable showing annotation events from this query. For example you might have two
annotation queries named `Deploys` and `Outages`. The toggle will allow you to decide what annotations
to show.

### Annotation query details

The annotation query options are different for each data source. For information about annotations in a specific data source, refer to the specific [data source]({{< relref "../../../datasources/" >}}) topic.
