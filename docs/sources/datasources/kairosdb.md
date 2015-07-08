---
page_title: KairosDB Guide
page_description: KairosDB guide for Grafana
page_keywords: grafana, kairosdb, documentation
---

# KairosDB Guide

## Adding the data source to Grafana
Open the side menu by clicking the the Grafana icon in the top header. In the side menu under the `Dashboards` link you
should find a link named `Data Sources`. If this link is missing in the side menu it means that your current
user does not have the `Admin` role for the current organization.

<!-- ![](/img/v2/add_datasource_kairosdb.png) -->

Now click the `Add new` link in the top header.

Name | Description
------------ | -------------
Name | The data source name, important that this is the same as in Grafana v1.x if you plan to import old dashboards.
Default | Default data source means that it will be pre-selected for new panels.
Url | The http protocol, ip and port of your kairosdb server (default port is usually 8080)
Access | Proxy = access via Grafana backend, Direct = access directory from browser.

## Query editor
Open a graph in edit mode by click the title.

<!-- ![](/img/v2/kairosdb_query_editor.png) -->

For details on KairosDB metric queries checkout the offical.

- [Query Metrics - KairosDB 0.9.4 documentation](http://kairosdb.github.io/kairosdocs/restapi/QueryMetrics.html).

## Templated queries
KairosDB Datasource Plugin provides following functions in `Variables values query` field in Templating Editor to query `metric names`, `tag names`, and `tag values` to kairosdb server.

Name | Description
---- | ----
`metrics(query)` | Returns a list of metric names. If nothing is given, returns a list of all metric names.
`tag_names(query)` | Returns a list of tag names. If nothing is given, returns a list of all tag names.
`tag_values(query)` | Returns a list of tag values. If nothing is given, returns a list of all tag values.

For details of `metric names`, `tag names`, and `tag values`, please refer to the KairosDB documentations.

- [List Metric Names - KairosDB 0.9.4 documentation](http://kairosdb.github.io/kairosdocs/restapi/ListMetricNames.html)
- [List Tag Names - KairosDB 0.9.4 documentation](http://kairosdb.github.io/kairosdocs/restapi/ListTagNames.html)
- [List Tag Values - KairosDB 0.9.4 documentation](http://kairosdb.github.io/kairosdocs/restapi/ListTagValues.html)
