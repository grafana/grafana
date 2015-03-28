----
page_title: InfluxDB query guide
page_description: InfluxDB query guide
page_keywords: grafana, influxdb, metrics, query, documentation
---


# InfluxDB

There are currently two separate datasources for InfluxDB in Grafana: InfluxDB 0.8.x and InfluxDB 0.9.x. The API and capabilities of InfluxDB 0.9.x are completely different from InfluxDB 0.8.x. InfluxDB 0.9.x data source support is provided on an experimental basis.

## InfluxDB 0.9 query editor

The InfluxDB 0.9 query editor provides support for building metric queries based on combinations of metric names and tags. It reuses elements of the Graphite query editor to help find the appropriate series. 

## InfluxDB 0.8 query editor

![](/img/v1/influxdb_editor.png)

When you add an InfluxDB query you can specify series name (can be regex), value column and a function. Group by time can be specified or if left blank will be automatically set depending on how long the current time span is. It will translate to a InfluxDB query that looks like this:

```sql
select [[func]]([[column]]) from [[series]] where [[timeFilter]] group by time([[interval]]) order asc
```

To write the complete query yourself click the cog wheel icon to the right and select ``Raw query mode``.

## InfluxDB 0.9 Filters & Templates queries

The InfluxDB 0.9 data source does not currently support filters or templates.

## InfluxDB 0.8 Filters & Templated queries

![](/img/animated_gifs/influxdb_templated_query.gif)


Use a distinct influxdb query in the filter query input box:

```sql
select distinct(host) from app.status
```



