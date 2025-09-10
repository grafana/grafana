---
aliases:
  - ../../data-sources/aws-cloudwatch/query-editor/
  - ../cloudwatch/
  - ./
description: Guide for using the Amazon CloudWatch data source's query editor
keywords:
  - grafana
  - aws
  - cloudwatch
  - guide
  - queries
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Query editor
title: Amazon CloudWatch query editor
weight: 200
refs:
  query-transform-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  query-transform-data-navigate-the-query-tab:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/#navigate-the-query-tab
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/#navigate-the-query-tab
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/
---

# Amazon CloudWatch query editor

Grafana provides a query editor for the CloudWatch data source, which allows you to query, visualize, and alert on logs and metrics stored in Amazon CloudWatch. It is located on the [Explore](ref:explore) page. For general documentation on querying data sources in Grafana, refer to [Query and transform data](ref:query-transform-data).

## Choose a query editing mode

The CloudWatch data source can query data from both CloudWatch metrics and CloudWatch Logs APIs, each with its own specialized query editor.

- [CloudWatch Metrics](#query-cloudwatch-metrics)
- [CloudWatch Logs](#query-cloudwatch-logs)

Select the API to query using the drop-down to the right of the **Region** setting.

## CloudWatch Metrics query editor components

The following are the components of the CloudWatch query editor.

| **Setting**     | **Description**                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Region**      | Select an AWS region if it differs from the default.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Namespace**   | The AWS service namespace. Examples: `AWS/EC2`, `AWS_Lambda`.                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Metric name** | The name of the metric you want to visualize. Example: `CPUUtilization`.                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Statistic**   | Choose how to aggregate your data. Examples: `sum`, `average`, `maximum`.                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Dimensions**  | Select dimensions from the drop-down. Examples: `InstanceId`, `FunctionName`, `latency`. You can add several dimensions to your query.                                                                                                                                                                                                                                                                                                                                    |
| **Match exact** | _Optional_. When enabled, this option restricts query results to metrics that precisely match the specified dimensions and their values. All dimensions of the queried metric must be explicitly defined in the query to ensure an exact schema match. If disabled, the query will also return metrics that match the defined schema but possess additional dimensions.                                                                                                   |
| **ID**          | _Optional_. Unique identifier required by the GetMetricData API for referencing queries in math expressions. Must start with a lowercase letter and can include letters, numbers, and underscores. If not specified, Grafana generates an ID using the pattern `query[refId]` (for example, `queryA`for the first query row).                                                                                                                                             |
| **Period**      | The minimum time interval, in seconds, between data points. The default is `auto`. Valid values are 1, 5, 10, 30, or any multiple of 60. When set to auto or left blank, Grafana calculates the period using time range in seconds / 2000, then rounds up to the next value (60, 300, 900, 3600, 21600, 86400) based on the [CloudWatch retention policy](https://aws.amazon.com/about-aws/whats-new/2016/11/cloudwatch-extends-metrics-retention-and-new-user-interface/). |
| **Label**       | _Optional_. Add a customized time series legend name. The label field overrides the default metric legend name using CloudWatch dynamic labels. Time-based dynamic labels like ${MIN_MAX_TIME_RANGE} derive legend values from the current timezone in the time range picker. For the full list of label patterns and limitations, refer to [CloudWatch dynamic labels](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/graph-dynamic-labels.html).        |

## Use Builder mode

Create a query in Builder mode:

1. Browse and select a metric namespace, metric name, filter, group, and order options using information from the [Metrics Insights keywords table](#metrics-insights-keywords).
1. For each of these keywords, choose from the list of available options.

Grafana constructs a SQL query based on your selections.

## Use Code mode

You can also write your SQL query directly in a code editor by using Code mode.

The code editor includes a built-in autocomplete feature that suggests keywords, aggregations, namespaces, metrics, labels, and label values.
Suggestions appear after typing a space, comma, or dollar (`$`) character, or by pressing <key>CTRL</key>+<key>Space</key>.

{{< admonition type="note" >}}
Template variables in the code editor can interfere with autocompletion.
{{< /admonition >}}

To run the query, click **Run query** above the code editor.

### Metrics editor

When you select `Builder` mode within the Metric search editor, a new Account field is displayed. Use the Account field to specify which of the linked accounts to target for the given query. By default, the `All` option is specified, which will target all linked accounts.

While in `Code` mode, you can specify any math expression. If the Monitoring account badge displays in the query editor header, all `SEARCH` expressions entered in this field will be cross-account by default. You can limit the search to one or a set of accounts, as documented in the [AWS documentation](http://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Unified-Cross-Account.html).

### Logs editor

The Log group selector specifies the target log groups for the logs query. When the Monitoring account badge appears in the query editor header, you can search and select log groups across multiple accounts. Use the `Account` field to filter log groups by account. For large numbers of log groups, use prefix search to narrow the selection.

## Query CloudWatch metrics

You can create two types of queries in the CloudWatch query editor:

- [Metric Search](#metric-search-queries), which help you retrieve and filter available metrics.
- [Metric Query](#create-a-metric-insights-queries), which use the Metrics Insights feature to fetch time series data.

The query type you use depends on how you want to interact with AWS metrics. Use the drop-down in the upper middle of the query editor to select which type you want to create.

### Metric Search queries

Metric search queries help you discover and filter available metrics. These queries use wildcards and filters to find metrics without needing to know exact metric names.

A valid metric query requires a specified namespace, metric name, and at least one statistic. Dimensions are optional, but if included, you must provide both a `key` and a `value`.

The `Match Exact` option controls how dimension filtering is applied to metric queries. When you enable `match exact`, the query returns only metrics whose dimensions precisely match the specified criteria.

This requires the following:

- All dimensions present on the target metric must be explicitly specified.
- Dimensions you don't want to filter by must use a wildcard (\*) filter.
- The metric schema must match exactly as defined in the [CloudWatch metric schema](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/search-expression-syntax.html) documentation.

When `Match Exact` is disabled, you can specify any subset of dimensions for filtering. The query returns metrics that:

- Match the specified namespace and metric name.
- Match all defined dimension filters.
- May contain additional dimensions beyond those specified.

This mode provides more flexible querying but may return metrics with unexpected additional dimensions.

The data source returns up to 100 metrics matching your filter criteria.

Enhance metric queries using template variables to create dynamic, reusable dashboards.

### Create dynamic queries with dimension wildcards

Use the asterisk (`*`) wildcard for dimension values to create dynamic queries that automatically monitor changing sets of AWS resources.

{{< figure src="/static/img/docs/cloudwatch/cloudwatch-dimension-wildcard-8.3.0.png" max-width="500px" caption="CloudWatch dimension wildcard" >}}

The query returns the average CPU utilization for all EC2 instances in the default region. With `Match Exact` disabled and `InstanceId` using a wildcard, the query retrieves metrics for any EC2 instance regardless of additional dimensions.

Auto-scaling events add new instances to the graph without manual instance ID tracking. This feature supports up to 100 metrics.

Click the [**Query inspector**](ref:query-transform-data-navigate-the-query-tab) button and select **Meta Data** to see the search expression that's automatically built to support wildcards.

To learn more about search expressions, refer to the [CloudWatch documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/search-expression-syntax.html).
The search expression is defined by default in such a way that the queried metrics must match the defined dimension names exactly.
This means that in the example, the query returns only metrics with exactly one dimension containing the name `InstanceId`.

{{< figure src="/static/img/docs/cloudwatch/cloudwatch-meta-inspector-8.3.0.png" max-width="500px" class="docs-image--right" caption="CloudWatch Meta Inspector" >}}

Disabling `Match Exact` includes metrics with additional dimensions and creates a search expression even without wildcards. Grafana searches for any metric matching at least the namespace, metric name, and all defined dimensions.

### Use multi-value template variables

When defining dimension values based on multi-valued template variables, the data source uses a search expression to query for the matching metrics.
This enables the use of multiple template variables in one query, and also lets you use template variables for queries that have the `Match Exact` option disabled.

Search expressions are limited to 1,024 characters, so your query might fail if you have a long list of values.
We recommend using the asterisk (`*`) wildcard instead of the `All` option to query all metrics that have any value for a certain dimension name.

Multi-valued template variables are supported only for dimension values.
Using multi-valued template variables for `Region`, `Namespace`, or `Metric Name` is not supported.

### Use metric math expressions

Create new time series metrics using mathematical functions on CloudWatch metrics. This supports arithmetic operators, unary subtraction, and other functions. For available functions, refer to [AWS Metric Math](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/using-metric-math.html).

To apply arithmetic operations, assign a unique string ID to the raw metric, then reference this ID in the `Expression` field of the new metric.

{{< admonition type="note" >}}
If you use the expression field to reference another query, such as `queryA * 2`, you can't create an alert rule based on that query.
{{< /admonition >}}

### Period macro

If you use a CloudWatch [`SEARCH`](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/search-expression-syntax.html) expression, consider using the `$__period_auto` macro rather than specifying a period explicitly. The `$__period_auto` macro will resolve to a [CloudWatch period](https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_GetMetricData.html) that is suitable for the chosen time range.

## Create queries for alerting

Alerting requires queries that return numeric data, which CloudWatch Logs supports.
For example, you can enable alerts through the use of the `stats` command.

The following is a valid query for alerting on messages that include the text "Exception":

```
filter @message like /Exception/
    | stats count(*) as exceptionCount by bin(1h)
    | sort exceptionCount desc
```

{{< admonition type="note" >}}
If you receive an error like `input data must be a wide series but got ...` when trying to alert on a query, make sure that your query returns valid numeric data that can be output to a Time series panel.
{{< /admonition >}}

For more information on Grafana alerts, refer to [Alerting](ref:alerting).

### Deep-link Grafana panels to the CloudWatch console

{{< figure src="/static/img/docs/v65/cloudwatch-deep-linking.png" max-width="500px" class="docs-image--right" caption="CloudWatch deep linking" >}}

Left-clicking a time series in the panel displays a context menu with a link to `View in CloudWatch console`.
Clicking the link opens a new tab that takes you to the CloudWatch console and displays all metrics for that query.
If you're not logged in to the CloudWatch console, the link forwards you to the login page.
The link provided is valid for any account but displays the expected metrics only if you're logged in to the account that corresponds to the selected data source in Grafana.

This feature is not available for metrics based on [metric math expressions](#metric-math-expressions).

### Metric Insights queries

The Metrics Query option in the CloudWatch data source is referred to as **Metric Insights** in the AWS console.
It's a fast, flexible, SQL-based query engine that you can use to identify trends and patterns across millions of operational metrics in real time.

The metrics query editor's Metrics Query option has two editing modes:

- [Builder mode](#use-builder-mode), which provides a visual query-building interface.
- [Code mode](#use-code-mode), which provides a code editor for writing queries.

#### Use Metric Insights syntax

Metric Insights uses a dialect of SQL and this query syntax:

```sql
SELECT FUNCTION(MetricName)
FROM Namespace | SCHEMA(...)
[ WHERE labelKey OPERATOR labelValue [AND|...]]
[ GROUP BY labelKey [, ...]]
[ ORDER BY FUNCTION() [DESC | ASC] ]
[ LIMIT number]
```

For details about the Metrics Insights syntax, refer to the [AWS reference documentation](https://docs.aws.amazon.com/console/cloudwatch/metricsinsights-syntax).

For information about Metrics Insights limits, refer to the [AWS feature documentation](https://docs.aws.amazon.com/console/cloudwatch/metricsinsights).

You can also augment queries by using [template variables](../template-variables/).

#### Use Metrics Insights keywords

This table summarizes common Metrics Insights query keywords:

| Keyword      | Description                                                                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `FUNCTION`   | Required. Specifies the aggregate function to use, and also specifies the name of the metric to be queried. Valid values are AVG, COUNT, MAX, MIN, and SUM.                                                  |
| `MetricName` | Required. For example, `CPUUtilization`.                                                                                                                                                                     |
| `FROM`       | Required. Specifies the metric's source. You can specify either the metric namespace that contains the metric to be queried, or a SCHEMA table function. Namespace examples include `AWS/EC2`, `AWS/Lambda`. |
| `SCHEMA`     | Optional. Narrows the query results to only the metrics that are an exact match, or to metrics that do not match.                                                                                            |
| `WHERE`      | Optional. Filters the query results to only the metrics that match your specified expression. For example, `WHERE InstanceType != 'c3.4xlarge'`.                                                             |
| `GROUP BY`   | Optional. Groups the query results into multiple time series. For example, `GROUP BY ServiceName`.                                                                                                           |
| `ORDER BY`   | Optional. Specifies the order in which time series are returned. Options are `ASC`, `DESC`.                                                                                                                  |
| `LIMIT`      | Optional. Limits the number of time series returned.                                                                                                                                                         |

## Query CloudWatch Logs

The logs query editor helps you write CloudWatch Logs Query Language queries across specified regions and log groups.

It supports querying CloudWatch logs with three query language options:

- **Logs Insights QL** - The AWS native query language specifically designed for CloudWatch Logs. It uses a SQL-like syntax with commands like `fields`, `filter`, `stats`, and `sort`. It's optimized for the Cloudwatch log structure and offers built-in functions for parsing timestamps, extracting fields from JSON logs, and performing aggregations.
- **OpenSearch PPL** - The OpenSearch query language is based on Elasticsearch's query DSL (Domain Specific Language). It uses a pipe-based syntax similar to Unix command-line tools or the Splunk search language, and supports complex boolean logic, range queries, wildcard matching, and full-text search capabilities.
- **OpenSearch SQL** - OpenSearch SQL is a query language that uses a SQL-like syntax for querying data in OpenSearch. It supports standard SQL queries and is designed for users familiar with SQL.

**Create a CloudWatch Logs query:**

1. Select a region.
1. Select **CloudWatch Logs** from the query type drop-down.
1. Select the query language you would like to use in the **Query Language** drop-down.
1. Click **Select log groups** and choose up to 20 log groups to query.
1. Use the main input area to write your logs query. Amazon CloudWatch only supports a subset of OpenSearch SQL and PPL commands. To find out more about the syntax supported, consult [Amazon CloudWatch Logs documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_AnalyzeLogData_Languages.html)

   {{< admonition type="note" >}}
   You must specify the region and log groups when querying with **Logs Insights QL** and **OpenSearch PPL**. **OpenSearch SQL** doesn't require log group selection. However, selecting log groups simplifies query writing by populating syntax suggestions with discovered log group fields.
   {{< /admonition >}}

Click **CloudWatch Logs Insights** to interactively view, search, and analyze your log data in the CloudWatch Logs Insights console. If you're not logged in to the CloudWatch console, the link forwards you to the login page.

### Query Log groups with OpenSearch SQL

When querying log groups with OpenSearch SQL, you **must** explicitly state the log group identifier or ARN in the `FROM` clause:

```sql
SELECT window.start, COUNT(*) AS exceptionCount
FROM `log_group`
WHERE `@message` LIKE '%Exception%'
```

or, when querying multiple log groups:

```sql
SELECT window.start, COUNT(*) AS exceptionCount
FROM `logGroups( logGroupIdentifier: ['LogGroup1', 'LogGroup2'])`
WHERE `@message` LIKE '%Exception%'
```

You can also write queries returning time series data by using the [`stats` command](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_Insights-Visualizing-Log-Data.html).
When making `stats` queries in [Explore](ref:explore), ensure you are in Metrics Explore mode.

## Cross-account observability

The CloudWatch plugin monitors and troubleshoots applications that span multiple accounts within a region. Cross-account observability enables seamless searching, visualization, and analysis of metrics and logs across account boundaries.

To enable cross-account observability, complete the following steps:

1. Go to the [Amazon CloudWatch documentation](http://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Unified-Cross-Account.html) and follow the instructions for enabling cross-account observability.

1. Add [two API actions](https://grafana.com//docs/grafana/latest/datasources/aws-cloudwatch/configure/#cross-account-observability-permissions) to the IAM policy attached to the role/user running the plugin.

Cross-account querying is available in the plugin through the **Logs**, **Metric search**, and **Metric Insights** modes.
After you have configured it, you'll see a **Monitoring account** badge in the query editor header.

{{< figure src="/static/img/docs/cloudwatch/cloudwatch-monitoring-badge-9.3.0.png" max-width="1200px" caption="Monitoring account badge" >}}

## Query caching

When you enable [query and resource caching](/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/#query-and-resource-caching), Grafana temporarily stores the results of data source queries and resource requests. Query caching is available in CloudWatch Metrics in Grafana Cloud and Grafana Enterprise. It is not available in CloudWatch Logs Insights due to how query results are polled from AWS.
