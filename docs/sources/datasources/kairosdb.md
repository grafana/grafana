---
page_title: KairosDB Guide
page_description: KairosDB guide for Grafana
page_keywords: grafana, kairosdb, documentation
---

# KairosDB Guide
Grafana v2.1 brings initial support for KairosDB Datasources. While the process of adding the datasource is similar to adding a Graphite or OpenTSDB datasource type, Kairos DB does have a few different options for building queries.

## Adding the data source to Grafana
![](/img/v2/add_kairosDB.jpg)

1. Open the side menu by clicking the the Grafana icon in the top header. 
2. In the side menu under the `Dashboards` link you should find a link named `Data Sources`.    

    > NOTE: If this link is missing in the side menu it means that your current user does not have the `Admin` role for the current organization.

3. Click the `Add new` link in the top header.
4. Select `KairosDB` from the dropdown.



Name | Description
------------ | -------------
Name | The data source name, important that this is the same as in Grafana v1.x if you plan to import old dashboards.
Default | Default data source means that it will be pre-selected for new panels.
Url | The http protocol, ip and port of your kairosdb server (default port is usually 8080)
Access | Proxy = access via Grafana backend, Direct = access directory from browser.

## Query editor
Open a graph in edit mode by click the title.

![](/img/v2/kairos_query_editor.png)

For details on KairosDB metric queries checkout the offical.
- [Query Metrics - KairosDB 0.9.4 documentation](http://kairosdb.github.io/kairosdocs/restapi/QueryMetrics.html).

## Templated queries
KairosDB Datasource Plugin provides following functions in `Variables values query` field in Templating Editor to query `metric names`, `tag names`, and `tag values` to kairosdb server.

Name | Description
| ------- | --------|
`metrics(query)`  | Returns a list of metric names matching `query`. If nothing is given, returns a list of all metric names.
`tag_names(query)` | Returns a list of tag names matching `query`. If nothing is given, returns a list of all tag names.
`tag_values(metric,tag)` | Returns a list of values for `tag` from the given `metric`.

For details of `metric names`, `tag names`, and `tag values`, please refer to the KairosDB documentations.

- [List Metric Names - KairosDB 0.9.4 documentation](http://kairosdb.github.io/kairosdocs/restapi/ListMetricNames.html)
- [List Tag Names - KairosDB 0.9.4 documentation](http://kairosdb.github.io/kairosdocs/restapi/ListTagNames.html)
- [List Tag Values - KairosDB 0.9.4 documentation](http://kairosdb.github.io/kairosdocs/restapi/ListTagValues.html)
- [Query Metrics - KairosDB 0.9.4 documentation](http://kairosdb.github.io/kairosdocs/restapi/QueryMetrics.html).