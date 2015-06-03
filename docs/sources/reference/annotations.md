----
page_title: Annotations
page_description: Annotations user guide
page_keywords: grafana, annotations, guide, documentation
---

# Annotations
![](/img/v1/annotated_graph1.png)

Annotations provide a way to mark points on the graph with rich events. When you hover over an annotation
you can get title, tags, and text information for the event.

To add an annotation query click dashboard settings icon in top menu and select `Annotations` from the
dropdown. This will open the `Annotations` edit view. Click the `Add` tab to add a new annotation query.

### Graphite annotations

Graphite supports two ways to query annotations.

- A regular metric query, use the `Graphite target expression` text input for this
- Graphite events query, use the `Graphite event tags` text input, specify an tag or wildcard (leave empty should also work)

## Elasticsearch annotations
![](/img/v2/annotations_es.png)

Grafana can query any Elasticsearch index for annotation events. The index name can be the name of an alias or an index wildcard pattern.
You can leave the search query blank or specify a lucene query.

If your elasticsearch document has a timestamp field other than `@timestamp` you will need to specify that. As well
as the name for the fields that should be used for the annotation title, tags and text. Tags and text are optional.

> **Note** The annotation timestamp field in elasticsearch need to be in UTC format.

## InfluxDB Annotations
![](/img/v2/annotations_influxdb.png)

For InfluxDB you need to enter a query like in the above screenshot. You need to have the ```where $timeFilter``` part.
If you only select one column you will not need to enter anything in the column mapping fields.
If you have multiple columns you need to specify which column should be treated as title, tags and text column.

