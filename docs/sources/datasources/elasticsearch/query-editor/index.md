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

Grafana provides a query editor for Elasticsearch. Elasticsearch queries are in Lucene format. See [Query string syntax](https://www.elastic.co/guide/en/elasticsearch/reference/8.9/query-dsl-query-string-query.html#query-string-syntax) if you are new to working with Elasticsearch.

{{< figure src="/static/img/docs/elasticsearch/elastic-query-editor-10.1.png" max-width="800px" class="docs-image--no-shadow" caption="Elasticsearch query editor" >}}

For general documentation on querying data sources in Grafana, including options and functions common to all query editors, see [Query and transform data]({{< relref "../../../panels-visualizations/query-transform-data" >}}).

## Aggregation types

Elasticsearch groups aggregations into three categories:

- **Bucket** - Bucket aggregations don't calculate metrics, they create buckets of documents based on field values, ranges and a variety of other criteria. See [Bucket aggregations](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket.html) for additional information. Use bucket aggregations under `Group by` when creating a metrics query in the query builder.

- **Metrics** - Metrics aggregations perform calculations such as sum, average, min, etc. They can be single-value or multi-value. See [Metrics aggregations](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-metrics.html) for additional information. Use metrics aggregations in the metrics query type in the query builder.

- **Pipeline** - Elasticsearch pipeline aggregations work with inputs or metrics created from other aggregations (not documents or fields). There are parent and sibling and sibling pipeline aggregations. See [Pipeline aggregations](https://www.elastic.co/guide/en/elasticsearch/reference/8.9/search-aggregations-pipeline.html) for additional information.

## Common options

There are several different types of queries you can create using the Elasticsearch query editor. The following options are available for all query types.

### Add query

Regardless of query type, you can create multiple queries by clicking **+ Add query**.

### Inspector

Click **Inspector** to get detailed statistics regarding your query. Inspector functions as a kind of debugging tool that "inspects" your query. It provides query statistics under **Stats**, request response time under **Query**, data frame details under **{} JSON**, and the shape of your data under **Data**.

## Select a query type

There are three types of queries you can create with the Elasticsearch query builder. Each type is explained in detail below.

### Metrics query type

Metrics queries aggregate data and produce a variety of calculations such as count, min, max, etc. Click on the metric box to view a list of options in the dropdown menu. The default is `count`.

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

Use the **plus icon** to the right to add multiple metrics to your query. Click on the **eye icon** next to "Metric" to hide metrics, and the **garbage can icon** to remove metrics.

- **Group by options** - Create multiple group by options when constructing your Elasticsearch query. Date histogram is the default option. Below is a list of options in the dropdown menu.

  - terms - see [Terms aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-terms-aggregation.html).
  - filter - see [Filter aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-filter-aggregation.html).
  - geo hash grid - see [Geohash grid aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-geohashgrid-aggregation.html).
  - date histogram - for time series queries. See [Date histogram aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-datehistogram-aggregation.html).
  - histogram - Depicts frequency distributions. See [Histogram aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-histogram-aggregation.html).
  - nested (experimental) - See [Nested aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-nested-aggregation.html).

Each group by option will have a different subset of options to further narrow your query.  

The following options are specific to the **date histogram** bucket aggregation option.

  - **Time field** - Depicts date data options. The default option can be specified when configuring the Elasticsearch data source in the **Time field name** under the [**Elasticsearch details**](/docs/grafana/latest/datasources/elasticsearch/configure-elasticsearch-data-source/#elasticsearch-details) section. Otherwise **@timestamp** field will be used as a default option. 
  - **Interval** - Group by a type of interval. There are option to choose from the dropdown menu to select seconds, minutes, hours or day. You can also add a custom interval such as `30d` (30 days). `Auto` is the default option.
  - **Min doc count** - The minimum amount of data to include in your query. The default is `0`.
  - **Thin edges** - Select to trim edges on the time series data points. The default is `0`.
  - **Offset** - Changes the start value of each bucket by the specified positive(+) or negative (-) offset duration. Examples include `1h` for 1 hour, `5s` for 5 seconds or `1d` for 1 day.
  - **Timezone** - Select a timezone from the dropdown menu. The default is `Coordinated universal time`.

Configure the following options for the **terms** bucket aggregation option:

  - **Order** - Sets the order of data.  Options are `top` or `bottom.`
  - **Size** - Limits the size of the data set.  You can set a custom number or `no limit`.
  - **Min doc count** - The minimum amount of data to include in your query. The default is `0`.
  - **Order by** - Order terms by `term value`, `doc count` or `count`.
  - **Missing** - 

Configure the following options for the **filters** bucket aggregation option:

  - **Query** - Sets the order of data.  Options are `top` or `bottom.`
  - **Label** - Add any labels to filter by.

Configure the following options for the **geo hash grid** bucket aggregation option:

   - **Precision** - Specifies the number of characters of the geo hash.

Configure the following options for the **histogram** bucket aggregation option:

  - **Interval** - Group by a type of interval. There are option to choose from the dropdown menu to select seconds, minutes, hours or day. You can also add a custom interval such as `30d` (30 days). `Auto` is the default option.
  - **Min doc count** - The minimum amount of data to include in your query. The default is `0`

The **nested** group by option is currently experimental, you can select a field and then settings specific to that field. 

Click the **+ sign** to add multiple group by options. The data will grouped in order (first by, then by).

{{< figure src="/static/img/docs/elasticsearch/group-by-then-by-10.2.png" max-width="850px" class="docs-image--no-shadow" caption="Group by options" >}}

### Logs query type

Logs queries analyze Elasticsearch log data. You can configure the following options:

- **Logs Options/Limit** - Limits the number of logs to analyze. The default is `500`.

#### Logs volume panel

The logs volume panel depicts a histogram of your logs in the time range specified in the toolbar next to the **Run query** button in the upper right.

{{< figure src="/static/img/docs/elasticsearch/logs-volume-panel-10.2.png" max-width="850px" class="docs-image--no-shadow" caption="Logs volume panel" >}}

#### Logs panel

The logs panel contains several toggle options to display your data in greater detail and make it easier to read. For general documentation on how to work with logs in Explore in Grafana see [Logs in Explore]({{< relref "../../../explore/logs-integration" >}}).

{{< figure src="/static/img/docs/elasticsearch/logs-query-type-10.1.png" max-width="850px" class="docs-image--no-shadow" caption="Logs panel" >}}

- **Time** - Toggle to do display the time column. This is the timestamp associated with the log line as reported from the data source.

- **Unique labels** - Toggle to do display the unique labels column that includes only non-common labels.

- **Wrap lines** - Toggle if you want the display to use line wrapping.

- **Pretty JSON** - Toggle to pretty print JSON data to make it easier to read.

- **Deduplication** - Makes repetitive log data easier to read. `Exact` matches are done on the whole line with the exception for date fields. `Numbers` matches are done on the line after stripping out numbers such as durations, IP addresses, and so on. `Signature` is the most aggressive deduplication as it strips all letters and numbers and matches on the remaining whitespace and punctuation. The default is `None`.

- **Display results** - Change the order of received logs from the newest first (descending order) to oldest first (ascending order). The default is `Newest first`.

- **Download** - Click to download log results in either `txt`or `json` format.

Click on a specific log to get an expanded details view of each log, which provides additional information including `fields` and `links` attached to the log lines. See [Log details view](/docs/grafana/latest/explore/logs-integration/#log-details-view) for more information.

### Raw data query type

Run a raw data query to retrieve a table of all fields that are associated with each log line.

- **Raw data size** - Number of raw data documents. You can specify a different amount. The default is `500`.

{{% admonition type="note" %}}
The option to run a **raw document query** is deprecated as of Grafana v10.1.
{{% /admonition %}}

## Use template variables

You can also augment queries by using [template variables]({{< relref "./template-variables/" >}}).

Queries of `terms` have a 500-result limit by default.
To set a custom limit, set the `size` property in your query.

{{% docs/reference %}}
[query-transform-data]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/query-transform-data"
[query-transform-data]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/query-transform-data"
{{% /docs/reference %}}

