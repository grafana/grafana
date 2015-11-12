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

Here you can specify a default for the `time field` and specify the name of your elasticsearch index. You can use
a time pattern for the index name or a wildcard.

## Metric Query editor

![](/img/elasticsearch/query_editor.png)

The Elasticsearch query editor allows you to select multiple metrics and group by multiple terms or filters. Use the plus and minus icons to the right to add / remove
metrics or group bys. Some metrics and group by have options, click the option text to expand the the row to view and edit metric or group by options.

## Annotations
TODO

