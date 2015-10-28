----
page_title: Bosun query guide
page_description: Bosun query guide
page_keywords: grafana, bosun, metrics, query, documentation
---

# Bosun
Grafana includes support for Bosun Datasources. The Bosun datasource lets you put in bosun expressions into a text field and then uses bosun's expression endpoint to execute them. It is similar to using Bosun's expression page. Currently, all expressions that return a seriesSet (time series) are supported.

## Adding the data source to Grafana
![](/img/v2/add_Bosun.png)

1. Open the side menu by clicking the the Grafana icon in the top header. 
2. In the side menu under the `Dashboards` link you should find a link named `Data Sources`.    

    > NOTE: If this link is missing in the side menu it means that your current user does not have the `Admin` role for the current organization.

3. Click the `Add new` link in the top header.
4. Select `Bosun` from the dropdown.

Name | Description
------------ | -------------
Name | The data source name, important that this is the same as in Grafana v1.x if you plan to import old dashboards.
Default | Default data source means that it will be pre-selected for new panels.
Url | The http protocol, ip and port of you Bosun server.
Access | Proxy = access via Grafana backend, Direct = access directory from browser. You should use 'proxy' with Bosun's backend.

 > Proxy access means that the Grafana backend will proxy all requests from the browser, and send them on to the Data Source. This is useful because it can eliminate CORS (Cross Origin Site Resource) issues, as well as eliminate the need to disseminate authentication details to the Data Source to the browser

## Query editor
Open a graph in edit mode by click the title. The query field lets you enter in expressions that return a bosun SeriesSet (time series). Two variables are interpolated by Grafana before sending the expression to Bosun:

 * $start is replaced with seconds from the end time of Grafana's time selection.
 * $ds is replaced by grafana's recommend autodownsample interval.

Bosun's expression language is entirely based on relative time to "now". This backend sets "now" to be the end time of Grafana's time selection.

![](/img/v2/bosun_editor.png)

For details on Bosun expressions see Bosun's expression documentation
- [Bosun Expressions - Bosun documentation](http://bosun.org/expressions/).

