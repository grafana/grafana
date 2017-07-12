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

Annotations provide a way to mark points on the graph with rich events. When you hover over an annotation
you can get title, tags, and text information for the event.

![](/img/docs/annotations/toggles.png)

## Queries

Annotation events are fetched via annotation queries. To add a new annotation query to a dashboard
open the dashboard settings menu, then select `Annotations`. This will open the dashboard annotations
settings view. To create a new annotation query hit the `New` button.

![](/img/docs/annotations/new_query.png)

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


