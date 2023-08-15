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
    - data source
menuTitle: Query editor
title: Elasticsearch query editor
weight: 300
---

# Elasticsearch query editor

{{< figure src="/static/img/docs/elasticsearch/elastic-query-editor-10.1.png" max-width="800px" class="docs-image--no-shadow" caption="Elasticsearch query editor" >}}

Grafana provides a query editor for Elasticsearch. Elasticsearch queries are in Lucene format. See [Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html) if you are new to working with Elasticsearch.

For general documentation on querying data sources in Grafana, see [Query and transform data]({{< relref "../../../panels-visualizations/query-transform-data" >}}).

For options and functions common to all query editors, see [Query editors]({{< relref "../../../panels-visualizations/query-transform-data" >}}).

## Select a query type

You have three options with regard to the type of query you can run. Each type is explained in detail below.

### Aggregation types

Elasticsearch groups aggregation type into the following:

- **Metrics** -

- **Pipeline** - Elasticsearch pipeline metrics must be based on another metric. There are parent and sibling and sibling pipeline aggregations. See [Pipeline aggregations](https://www.elastic.co/guide/en/elasticsearch/reference/8.9/search-aggregations-pipeline.html) for additional information.

- **Bucket** - Use bucket aggregations under `Group by` in the query builder. Bucket aggregations don't calculate metrics, they create buckets of documents. See [Bucket aggregations](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket.html) for additional information.

### Metrics query type

Metrics queries aggregate data.

- **Alias** - Aliasing only applies to **time series queries**, where the last group is `date histogram`. This is ignored for any other type of query.

- **Metric** - Metrics aggregations include:

- count - see [Value count aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/8.9/search-aggregations-metrics-valuecount-aggregation.html)
- average - see [Avg aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/8.9/search-aggregations-metrics-rate-aggregation.html)
- sum - see [Sum aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-metrics-sum-aggregation.html)
- max - see [Max aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/8.9/search-aggregations-metrics-max-aggregation.html)
- min - see [Min aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/8.9/search-aggregations-metrics-min-aggregation.html)
- extended stats - see [Extended stats aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-metrics-extendedstats-aggregation.html)
- percentiles - see [Percentiles aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/8.9/search-aggregations-metrics-percentile-aggregation.html)
- unique count - see [Cardinlaity aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/8.9/search-aggregations-metrics-cardinality-aggregation.html)
- top metrics - see [Top metrics aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/8.9/search-aggregations-metrics-top-metrics.html)
- rate - see [Rate aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/8.9/search-aggregations-metrics-rate-aggregation.html)

You can select multiple metrics and group by multiple terms or filters when using the Elasticsearch query editor.

Use the plus icon to the right to add multiple metrics to your query.

**Group by options** -

You can utilize multiple group by options when constructing your Elasticsearch query. Date histogram is the default option.

- terms - see [Terms aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-terms-aggregation.html).
- filter - see [Filter aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-filter-aggregation.html).
- geo hash grid - see [Geohash grid aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-geohashgrid-aggregation.html).
- date histogram - for time series queries. See [Date histogram aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-datehistogram-aggregation.html).
- histogram - Depicts frequency distributions. See [Histogram aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-histogram-aggregation.html).
- nested (experimental) - See [Nested aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-nested-aggregation.html).

- **@timestamp** -

- **Interval** - Group by a type of interval. `Auto` is the default option. There are option to choose from the dropdown menu to select seconds, minutes, hours or day.

  - **Min doc count** - The default is `0`.
  - **Thin edges** - Select to trim edges on the time series data points. The default is `0`.
  - **Offset** - Changes rhw start value of each bucket by the specified positive(+) or negative (-) offset duration. Examples include 1h for 1 hour, 5s for 5 seconds or 1d for 1 day.
  - **Timezone** - Select a timezone. The default is `Coordinated universal time`.

Click the + sign to add multiple group by options. You will `then by`

Add a screenshot here.

### Logs query type

Log queries can be limited to a specific number of documents. The default is `500`.

Logs volume section -

Logs section or is it called panel?

{{< figure src="/static/img/docs/elasticsearch/logs-query-type-10.1.png" max-width="850px" class="docs-image--no-shadow" caption="Logs panel" >}}

Time - toggle on to do what?

Unique labels - toggle on to do what?

Wrap lines - toggle on to wrap lines?

pretty JSON - toggle on to do what?

Deduplication - select from none, exact, numbers and signature. The default is `None`.

Display results - newest first or oldest first are your 2 options. `Newest first` is the default.

You can download results in either text format or JSON.

### Raw data query type

Run a a raw data query to retrieve a table of all fields that are associated with each log line.

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

## Common options

### Add query

Regardless of query type, you can create multiple queries by clicking **+ Add query**.

### Inspector

Click **Inspector** to get detailed statistics regarding your query. Inspector functions as a kind of debugging tool that "inspects" your query. It provides query statistics under **Stats**, request response time under **Query**, data frame details under **{} JSON**, and the shape of your data under **Data**.
