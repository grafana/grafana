---
aliases:
  - ../../data-sources/elasticsearch/query-editor/
  - ../../data-sources/elasticsearch/template-variables/
description: Guide for using the Elasticsearch data source's query editor
keywords:
  - grafana
  - elasticsearch
  - lucene
  - metrics
  - logs
  - queries
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Query editor
title: Elasticsearch query editor
weight: 300
---

# Elasticsearch query editor

{{< figure src="/static/img/docs/elasticsearch/elastic-query-editor-10.1.png" max-width="800px" class="docs-image--no-shadow" caption="Elasticsearch query editor" >}}

Grafana provides a query editor for Elasticsearch's Query DSL language. See [Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html) if you are new to working with Elasticsearch.

For general documentation on querying data sources in Grafana, see [Query and transform data]({{< relref "../../../panels-visualizations/query-transform-data" >}}).

For options and functions common to all query editors, see [Query editors]({{< relref "../../../panels-visualizations/query-transform-data" >}}).

## Select a query type

You have options with regard to the type of query you can run.

### Metrics query type

Metrics queries aggregate data. Metrics aggregations include

- count
- average
- sum - see [Sum aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-metrics-sum-aggregation.html)
- max
- min
- extended stats - see [Extended stats aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-metrics-extendedstats-aggregation.html)
- percentiles
- unique count
- top metrics
- rate

You can select multiple metrics and group by multiple terms or filters when using the Elasticsearch query editor.

Use the plus and minus icons to the right to add and remove metrics or group by clauses.
To expand the row to view and edit any available metric or group-by options, click the option text.

Group by options

- terms
- filter
- geo hash grid
- date histogram
- histogram
- nested (experimental) -

### Control pipeline metrics visibility

Some metric aggregations, such as _Moving Average_ and _Derivative_, are called **Pipeline** aggregations.
Elasticsearch pipeline metrics must be based on another metric.

Use the eye icon next to the metric to prevent metrics from appearing in the graph.
This is useful for metrics you only have in the query for use in a pipeline metric.

{{< figure src="/static/img/docs/elasticsearch/pipeline-aggregation-editor-7-4.png" max-width="500px" class="docs-image--no-shadow" caption="Pipeline aggregation editor" >}}

### Logs query type

Log queries can be limited to a specific number of documents. The default is `500`.

raw data -

{{< figure src="/static/img/docs/elasticsearch/logs-query-type-10.1.png" max-width="850px" class="docs-image--no-shadow" caption="Logs query type" >}}

### Raw data query type

What is a raw data query?

What is the size of 500? Is that the default? Is it documents? You can change the size.

{{% admonition type="note" %}}
The option to run a **raw document query** is deprecated as of Grafana version xxxx.
{{% /admonition %}}

## Use template variables

You can also augment queries by using [template variables]({{< relref "./template-variables/" >}}).

## Name a time series

You can control the name for time series via the `Alias` input field.

| Pattern              | Replacement value                      |
| -------------------- | -------------------------------------- |
| `{{term fieldname}}` | Value of a term group-by               |
| `{{metric}}`         | Metric name, such as Average, Min, Max |
| `{{field}}`          | Metric field name                      |

## Create a query

Write the query using a custom JSON string, with the field mapped as a [keyword](https://www.elastic.co/guide/en/elasticsearch/reference/current/keyword.html#keyword) in the Elasticsearch index mapping.

If the query is [multi-field](https://www.elastic.co/guide/en/elasticsearch/reference/current/multi-fields.html) with both a `text` and `keyword` type, use `"field":"fieldname.keyword"` (sometimes `fieldname.raw`) to specify the keyword field in your query.

| Query                                                               | Description                                                                                                                                                                   |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{"find": "fields", "type": "keyword"}`                             | Returns a list of field names with the index type `keyword`.                                                                                                                  |
| `{"find": "terms", "field": "hostname.keyword", "size": 1000}`      | Returns a list of values for a keyword using term aggregation. Query will use current dashboard time range as time range query.                                               |
| `{"find": "terms", "field": "hostname", "query": '<Lucene query>'}` | Returns a list of values for a keyword field using term aggregation and a specified Lucene query filter. Query will use current dashboard time range as time range for query. |

Queries of `terms` have a 500-result limit by default.
To set a custom limit, set the `size` property in your query.

## Common options

### Add query

Regardless of query type, you can create multiple queries by clicking **+ Add query**.

### Inspector

Click **Inspector** to get detailed statistics regarding your query. Inspector functions as a kind of debugging tool that "inspects" your query. It provides query statistics under **Stats**, request response time under **Query**, data frame details under **{} JSON**, and the shape of your data under **Data**.
