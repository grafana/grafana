+++
title = "Annotations"
keywords = ["grafana", "annotations", "documentation", "guide"]
type = "docs"
[menu.docs]
name = "Annotations"
parent = "dashboard_features"
weight = 2
+++

# Annotations

{{< docs-imagebox img="/img/docs/v46/annotations.png" max-width="800px" >}}

Annotations provide a way to mark points on the graph with rich events. When you hover over an annotation
you can get event description and event tags. The text field can include links to other systems with more detail.

## Native annotations

Grafana v4.6+ comes with a native annotation store and the ability to add annotation events directly from the graph panel or via the [HTTP API]({{< relref "http_api/annotations.md" >}}).

## Adding annotations

By holding down **CTRL** or **CMD** + Click. Add tags to the annotation will make it searchable from other dashboards.

{{< docs-imagebox img="/img/docs/annotations/annotation-still.png"
max-width="600px" animated-gif="/img/docs/annotations/annotation.gif" >}}

### Adding regions events

You can also hold down **CTRL** or **CMD** and select region to create a region annotation.

{{< docs-imagebox img="/img/docs/annotations/region-annotation-still.png"
max-width="600px" animated-gif="/img/docs/annotations/region-annotation.gif" >}}

### Built in query

After you added an annotation they will still be visible. This is due to the built in annotation query that exists on all dashboards. This annotation query will
fetch all annotation events that originate from the current dashboard and show them on the panel where they where created. This includes alert state history annotations. You can
stop annotations from being fetched & drawn by opening the **Annotations** settings (via Dashboard cogs menu) and modifying the query named `Annotations & Alerts (Built-in)`.

When you copy a dashboard using the **Save As** feature it will get a new dashboard id so annotations created on source dashboard will no longer be visible on the copy. You
can still show them if you add a new **Annotation Query** and filter by tags. But this only works if the annotations on the source dashboard had tags to filter by.

### Query by tag

You can create new annotation queries that fetch annotations from the native annotation store via the `-- Grafana --` data source and by setting *Filter by* to `Tags`. Specify at least
one tag. For example create an annotation query name `outages` and specify a tag named `outage`. This query will show all annotations you create (from any dashboard or via API) that
have the `outage` tag.

## Querying other data sources

Annotation events are fetched via annotation queries. To add a new annotation query to a dashboard
open the dashboard settings menu, then select `Annotations`. This will open the dashboard annotations
settings view. To create a new annotation query hit the `New` button.

<!--![](/img/docs/v50/annotation_new_query.png)-->
{{< docs-imagebox img="/img/docs/v50/annotation_new_query.png" max-width="600px" >}}

Specify a name for the annotation query. This name is given to the toggle (checkbox) that will allow
you to enable/disable showing annotation events from this query. For example you might have two
annotation queries named `Deploys` and `Outages`. The toggles will allow you to decide what annotations
to show.

### Annotation query details

The annotation query options are different for each data source.

- [Graphite annotation queries]({{< relref "features/datasources/graphite.md#annotations" >}})
- [Elasticsearch annotation queries]({{< relref "features/datasources/elasticsearch.md#annotations" >}})
- [InfluxDB annotation queries]({{< relref "features/datasources/influxdb.md#annotations" >}})
- [Prometheus annotation queries]({{< relref "features/datasources/prometheus.md#annotations" >}})
- [MySQL annotation queries]({{< relref "features/datasources/mysql.md#annotations" >}})
- [Postgres annotation queries]({{< relref "features/datasources/postgres.md#annotations" >}})
