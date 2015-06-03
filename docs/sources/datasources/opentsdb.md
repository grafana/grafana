---
page_title: OpenTSDB Guide
page_description: OpenTSDB guide for Grafana
page_keywords: grafana, opentsdb, documentation
---

# OpenTSDB Guide

## Adding the data source to Grafana
Open the side menu by clicking the the Grafana icon in the top header. In the side menu under the `Dashboards` link you
should find a link named `Data Sources`. If this link is missing in the side menu it means that your current
user does not have the `Admin` role for the current organization.

![](/img/v2/add_datasource_opentsdb.png)

Now click the `Add new` link in the top header.

Name | Description
------------ | -------------
Name | The data source name, important that this is the same as in Grafana v1.x if you plan to import old dashboards.
Default | Default data source means that it will be pre-selected for new panels.
Url | The http protocol, ip and port of you opentsdb server (default port is usually 4242)
Access | Proxy = access via Grafana backend, Direct = access directory from browser.

## Query editor
Open a graph in edit mode by click the title.

![](/img/v2/opentsdb_query_editor.png)

For details on opentsdb metric queries checkout the official [OpenTSDB documentation](http://opentsdb.net/docs/build/html/index.html)





