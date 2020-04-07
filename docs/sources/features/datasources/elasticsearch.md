+++
title = "Using Elasticsearch in Grafana"
description = "Guide for using Elasticsearch in Grafana"
keywords = ["grafana", "elasticsearch", "guide"]
type = "docs"
aliases = ["/docs/grafana/latest/datasources/elasticsearch"]
[menu.docs]
name = "Elasticsearch"
parent = "datasources"
weight = 3
+++

# Using Elasticsearch in Grafana

Grafana ships with advanced support for Elasticsearch. You can do many types of simple or complex Elasticsearch queries to
visualize logs or metrics stored in Elasticsearch. You can also annotate your graphs with log events stored in Elasticsearch.

## Adding the data source

1. Open the side menu by clicking the Grafana icon in the top header.
2. In the side menu under the `Dashboards` link you should find a link named `Data Sources`.
3. Click the `+ Add data source` button in the top header.
4. Select *Elasticsearch* from the *Type* dropdown.

> NOTE: If you're not seeing the `Data Sources` link in your side menu it means that your current user does not have the `Admin` role for the current organization.

Name | Description
------------ | -------------
*Name* | The data source name. This is how you refer to the data source in panels and queries.
*Default* | Default data source means that it will be pre-selected for new panels.
*Url* | The HTTP protocol, IP, and port of your Elasticsearch server.
*Access* | Server (default) = URL needs to be accessible from the Grafana backend/server, Browser = URL needs to be accessible from the browser.

Access mode controls how requests to the data source will be handled. Server should be the preferred way if nothing else stated.

### Server access mode (Default)

All requests will be made from the browser to Grafana backend/server which in turn will forward the requests to the data source and by that circumvent possible Cross-Origin Resource Sharing (CORS) requirements. The URL needs to be accessible from the grafana backend/server if you select this access mode.

### Browser (Direct) access

All requests will be made from the browser directly to the data source and may be subject to Cross-Origin Resource Sharing (CORS) requirements. The URL needs to be accessible from the browser if you select this access mode.

If you select Browser access you must update your Elasticsearch configuration to allow other domains to access
Elasticsearch from the browser. You do this by specifying these to options in your **elasticsearch.yml** config file.

```bash
http.cors.enabled: true
http.cors.allow-origin: "*"
```

### Index settings

![Elasticsearch data source details](/img/docs/elasticsearch/elasticsearch_ds_details.png)

Here you can specify a default for the `time field` and specify the name of your Elasticsearch index. You can use
a time pattern for the index name or a wildcard.

### Elasticsearch version

Be sure to specify your Elasticsearch version in the version selection dropdown. This is very important as there are differences on how queries are composed.
Currently the versions available are `2.x`, `5.x`, `5.6+`, `6.0+` or `7.0+`. The value `5.6+` means version 5.6 or higher, but lower than  6.0. The value `6.0+` means
version 6.0 or higher, but lower than 7.0. Finally, `7.0+` means version 7.0 or higher, but lower than 8.0.

### Min time interval

A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example `1m` if your data is written every minute.
This option can also be overridden/configured in a dashboard panel under data source options. It's important to note that this value **needs** to be formatted as a
number followed by a valid time identifier, e.g. `1m` (1 minute) or `30s` (30 seconds). The following time identifiers are supported:

Identifier | Description
------------ | -------------
`y`   | year
`M`   | month
`w`   | week
`d`   | day
`h`   | hour
`m`   | minute
`s`   | second
`ms`  | millisecond

### Logs (BETA)

> Only available in Grafana v6.3+.

There are two parameters, `Message field name` and `Level field name`, that can optionally be configured from the data source settings page that determine
which fields will be used for log messages and log levels when visualizing logs in [Explore]({{< relref "../explore" >}}).

For example, if you're using a default setup of Filebeat for shipping logs to Elasticsearch the following configuration should work:

- **Message field name:**  message
- **Level field name:** fields.level

## Metric Query editor

![Elasticsearch Query Editor](/img/docs/elasticsearch/query_editor.png)

The Elasticsearch query editor allows you to select multiple metrics and group by multiple terms or filters. Use the plus and minus icons to the right to add/remove
metrics or group by clauses. Some metrics and group by clauses haves options, click the option text to expand the row to view and edit metric or group by options.

## Series naming and alias patterns

You can control the name for time series via the `Alias` input field.

Pattern | Description
------------ | -------------
*{{term fieldname}}* |  replaced with value of a term group by
*{{metric}}* | replaced with metric name (ex. Average, Min, Max)
*{{field}}* | replaced with the metric field name

## Pipeline metrics

Some metric aggregations are called Pipeline aggregations, for example, *Moving Average* and *Derivative*. Elasticsearch pipeline metrics require another metric to be based on. Use the eye icon next to the metric to hide metrics from appearing in the graph. This is useful for metrics you only have in the query for use in a pipeline metric.

![](/img/docs/elasticsearch/pipeline_metrics_editor.png)

## Templating

Instead of hard-coding things like server, application and sensor name in you metric queries you can use variables in their place.
Variables are shown as dropdown select boxes at the top of the dashboard. These dropdowns makes it easy to change the data
being displayed in your dashboard.

Check out the [Templating]({{< relref "../../reference/templating.md" >}}) documentation for an introduction to the templating feature and the different
types of template variables.

### Query variable

The Elasticsearch data source supports two types of queries you can use in the *Query* field of *Query* variables. The query is written using a custom JSON string.

Query | Description
------------ | -------------
*{"find": "fields", "type": "keyword"}* | Returns a list of field names with the index type `keyword`.
*{"find": "terms", "field": "@hostname", "size": 1000}* |  Returns a list of values for a field using term aggregation. Query will use current dashboard time range as time range for query.
*{"find": "terms", "field": "@hostname", "query": '<lucene query>'}* | Returns a list of values for a field using term aggregation and a specified lucene query filter. Query will use current dashboard time range as time range for query.

There is a default size limit of 500 on terms queries. Set the size property in your query to set a custom limit.
You can use other variables inside the query. Example query definition for a variable named `$host`.

```
{"find": "terms", "field": "@hostname", "query": "@source:$source"}
```

In the above example, we use another variable named `$source` inside the query definition. Whenever you change, via the dropdown, the current value of the ` $source` variable, it will trigger an update of the `$host` variable so it now only contains hostnames filtered by in this case the
`@source` document property.

These queries by default return results in term order (which can then be sorted alphabetically or numerically as for any variable).
To produce a list of terms sorted by doc count (a top-N values list), add an `orderBy` property of "doc_count".
This automatically selects a descending sort; using "asc" with doc_count (a bottom-N list) can be done by setting `order: "asc"` but [is discouraged](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-terms-aggregation.html#search-aggregations-bucket-terms-aggregation-order) as it "increases the error on document counts".
To keep terms in the doc count order, set the variable's Sort dropdown to **Disabled**; you might alternatively still want to use e.g. **Alphabetical** to re-sort them.

```
{"find": "terms", "field": "@hostname", "orderBy": "doc_count"}
```

### Using variables in queries

There are two syntaxes:

- `$<varname>`  Example: @hostname:$hostname
- `[[varname]]` Example: @hostname:[[hostname]]

Why two ways? The first syntax is easier to read and write but does not allow you to use a variable in the middle of a word. When the *Multi-value* or *Include all value*
options are enabled, Grafana converts the labels from plain text to a lucene compatible condition.

![](/img/docs/v43/elastic_templating_query.png)

In the above example, we have a lucene query that filters documents based on the `@hostname`  property using a variable named `$hostname`. It is also using
a variable in the *Terms* group by field input box. This allows you to use a variable to quickly change how the data is grouped.

Example dashboard:
[Elasticsearch Templated Dashboard](https://play.grafana.org/dashboard/db/elasticsearch-templated)

## Annotations

[Annotations]({{< relref "../../reference/annotations.md" >}}) allows you to overlay rich event information on top of graphs. You add annotation
queries via the Dashboard menu / Annotations view. Grafana can query any Elasticsearch index
for annotation events.

Name | Description
------------ | -------------
Query | You can leave the search query blank or specify a lucene query
Time | The name of the time field, needs to be date field.
Time End | Optional name of the time end field, needs to be date field. If set, then annotations will be marked as a regions between time and time-end.
Text | Event description field.
Tags | Optional field name to use for event tags (can be an array or a CSV string).

## Querying Logs (BETA)

> Only available in Grafana v6.3+.

Querying and displaying log data from Elasticsearch is available via [Explore]({{< relref "../explore" >}}).

![](/img/docs/v63/elasticsearch_explore_logs.png)

Select the Elasticsearch data source, change to Logs using the Metrics/Logs switcher, and then optionally enter a lucene query into the query field to filter the log messages.

Finally, press the `Enter` key or the `Run Query` button to display your logs.

### Log Queries

Once the result is returned, the log panel shows a list of log rows and a bar chart where the x-axis shows the time and the y-axis shows the frequency/count.

Note that the fields used for log message and level is based on an [optional data source configuration](#logs-beta).

### Filter Log Messages

Optionally enter a lucene query into the query field to filter the log messages. For example, using a default Filebeat setup you should be able to use `fields.level:error` to only show error log messages.

## Configure the data source with provisioning

It's now possible to configure data sources using config files with Grafana's provisioning system. You can read more about how it works and all the settings you can set for data sources on the [provisioning docs page]({{< relref "../../administration/provisioning/#datasources" >}})

Here are some provisioning examples for this data source.

```yaml
apiVersion: 1

datasources:
  - name: Elastic
    type: elasticsearch
    access: proxy
    database: "[metrics-]YYYY.MM.DD"
    url: http://localhost:9200
    jsonData:
      interval: Daily
      timeField: "@timestamp"
```

or, for logs:

```yaml
apiVersion: 1

datasources:
  - name: elasticsearch-v7-filebeat
    type: elasticsearch
    access: proxy
    database: "[filebeat-]YYYY.MM.DD"
    url: http://localhost:9200
    jsonData:
      interval: Daily
      timeField: "@timestamp"
      esVersion: 70
      logMessageField: message
      logLevelField: fields.level
```
