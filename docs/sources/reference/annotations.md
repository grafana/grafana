----
page_title: Annotations
page_description: Annotations user guide
page_keywords: grafana, annotations, guide, documentation
---

# Annotations
![](/img/v1/annotated_graph1.png)

Annotations provide a way to mark points on the graph with rich events. When you hover over an annotation
you can get title, tags, and text information for the event.

To enable annotations open dashboard settings and the controls tab.
Under feature toggles you will find the checkbox for annotations.

When enabled they will appear in the sub menu controls area.
![](/img/v1/annotations_submenu1.png)

Click the cog wheel to open the dialog where you can add & edit annotations.
![](/img/v1/annotations_dialog1.png)

## Datasources
Grafana supports many data sources for annotation.

- Graphite metrics
- Graphite events
- InfluxDB query
- Elasticsearch query

## InfluxDB Annotations
![](/img/influxdb/influxdb_annotation.png)

For InfluxDB you need to enter a query like in the above screenshot. You need to have the ```where $timeFilter``` part.
If you only select one column you will not need to enter anything in the column mapping fields.
If you have multiple columns you need to specify which column should be treated as title, tags and text column.

## Elasticsearch Annotations
![](/img/v1/elasticsearch_annotations_edit.png)

You can use the same data source as you specified in config.js for storing grafana dashboards or you can specify another one.
The annotation definition contains an index name that will override the index name specified in config.js. The index name can
be the name of an alias or an index wildcard pattern. You can leave the search query blank or specify a lucene query.

If your elasticsearch document has a timestamp field other than ```@timestamp``` you will need to specify that. As well
as the name for the fields that should be used for the annotation title, tags and text. Tags and text are optional.

**The annotation timestamp field in elasticsearch need to be in UTC format**
