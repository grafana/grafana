----
page_title: Elasticsearch
page_description: Elasticsearch grafana datasource documentation
page_keywords: Elasticsearch, grafana, kibana, documentation, datasource, docs
---

# Elasticsearch

Grafana ships with advanced support for Elasticsearch. You can do many types of
simple or complex elasticsearch queries to visualize logs or metrics stored in elasticsearch. You can
also annotate your graphs with log events stored in elasticsearch.

## Adding the data source
![](/img/v2/add_Graphite.jpg)

1. Open the side menu by clicking the the Grafana icon in the top header.
2. In the side menu under the `Dashboards` link you should find a link named `Data Sources`.

    > NOTE: If this link is missing in the side menu it means that your current user does not have the `Admin` role for the current organization.

3. Click the `Add new` link in the top header.
4. Select `Elasticsearch` from the dropdown.

Name | Description
------------ | -------------
Name | The data source name, important that this is the same as in Grafana v1.x if you plan to import old dashboards.
Default | Default data source means that it will be pre-selected for new panels.
Url | The http protocol, ip and port of you elasticsearch server.
Access | Proxy = access via Grafana backend, Direct = access directory from browser.

Proxy access means that the Grafana backend will proxy all requests from the browser, and send them on to the Data Source. This is useful because it can eliminate CORS (Cross Origin Site Resource) issues, as well as eliminate the need to disseminate authentication details to the Data Source to the browser.

Direct access is still supported because in some cases it may be useful to access a Data Source directly depending on the use case and topology of Grafana, the user, and the Data Source.

### Direct access
If you select direct access you must update your Elasticsearch configuration to allow other domains to access
Elasticsearch from the browser. You do this by specifying these to options in your **elasticsearch.yml** config file.

    http.cors.enabled: true
    http.cors.allow-origin: "*"

### Index settings

![](/img/elasticsearch/elasticsearch_ds_details.png)

Here you can specify a default for the `time field` and specify the name of your elasticsearch index. You can use a time pattern for the index name or a wildcard.

You must also specify the Elasticsearch version you are using (it will modify the requests send to elasticsearch).

You can also enable the Fixed Schema option. It supposes that every metric type (e.g. cpu, memory) is stored in a single type within the elasticsearch index. It allows more precise auto-completion:
- one can autocomplete on the metric names only (and not all the fields in elastic)
- when a metric is selected, the tags autocompletes only for the tags associated with this metric

More details [at the end of this page](#fixed-schema-details).

## Metric Query editor

![](/img/elasticsearch/query_editor.png)

The Elasticsearch query editor allows you to select multiple metrics and group by multiple terms or filters. Use the plus and minus icons to the right to add / remove
metrics or group bys. Some metrics and group by have options, click the option text to expand the the row to view and edit metric or group by options.

## Pipeline metrics

If you have Elasticsearch 2.x and Grafana 2.6 or above then you can use pipeline metric aggregations like
**Moving Average** and **Derivative**. Elasticsearch pipeline metrics require another metric to be based on. Use the eye icon next to the metric
to hide metrics from appearing in the graph. This is useful for metrics you only have in the query to be used
in a pipeline metric.

![](/img/elasticsearch/pipeline_metrics_editor.png)

## Templating

The Elasticsearch datasource supports two types of queries you can use to fill template variables with values.

### Possible values for a field

```json
{"find": "terms", "field": "@hostname"}
```

### Fields filtered by type
```json
{"find": "fields", "type": "string"}
```

### Fields filtered by type, with filter
```json
{"find": "fields", "type": "string", "query": <lucene query>}
```

### Multi format / All format
Use lucene format.



## Annotations
TODO


## Fixed Schema details

This option imposes some constrains on the way you store you data. This allows more precise auto-completion and more performant queries (not implemnted yet).

### How should you store your data ?

- Every type of metric (e.g. cpu, memory) should be in a single type within the elasticsearch Index.
- Your model for your data in elastic must be flat (i.e. no nested fields) (this is true with and without the Fixed Schema option).
- Every document in elasticsearch can store only one metric e.g. it is *not* yet possible to display 
```json
{
    "timestamp": 1442165810,
    "cpu": 1.2,
    "memory": 368873
    "host": "my_hostname",
    "instance": "Local",
}
```

Only the first constrain is hard, and some developement could lift the two
others.

/!\ The auto-completion is based on the mapping of the index of the current
day. It supposes that the tags keys (not the values) of your metrics have not
changed over time.

### Configure the Elasticsearch index

For intance, if you want to stores your data on indexes starting with `test-metrics-`, you can use the following template for elasticsearch.
The data field in elasticsearch is the one you will use when adding the datasource

```json
PUT _template/metrics_template
{
  "template": "test-metrics-*",
  "settings": {
    "index": {
      "refresh_interval": "5s"
    }
  },
  "mappings": {
    "_default_": {
      "dynamic_templates": [
        {
          "strings": {
            "match": "*",
            "match_mapping_type": "string",
            "mapping":   { "type": "string",
                           "doc_values": true,
                           "index": "not_analyzed" }
          }
        }
      ],
      "_all":            { "enabled": false },
      "_source":            { "enabled": false },
      "properties": {
        "timestamp":    { "type": "date",    "doc_values": true}
      }
    }
  }
}
```

One can see [this blog](https://www.elastic.co/blog/elasticsearch-as-a-time-series-data-store) for more details on the template configuration.
