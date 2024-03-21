---
aliases:
  - ../../fundamentals/evaluate-grafana-alerts/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/evaluate-grafana-alerts/
  - ../../unified-alerting/fundamentals/evaluate-grafana-alerts/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/fundamentals/evaluate-grafana-alerts/
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/queries-conditions/
description: Define queries to get the data you want to measure and conditions that need to be met before an alert rule fires
keywords:
  - grafana
  - alerting
  - queries
  - conditions
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Queries and conditions
weight: 104
---

# Queries and conditions

In Grafana, queries play a vital role in fetching and transforming data from supported data sources, which include databases like MySQL and PostgreSQL, time series databases like Prometheus, InfluxDB and Graphite, and services like Elasticsearch, AWS CloudWatch, Azure Monitor and Google Cloud Monitoring.

For more information on supported data sources, see [Data sources][data-source-alerting].

The process of executing a query involves defining the data source, specifying the desired data to retrieve, and applying relevant filters or transformations. Query languages or syntaxes specific to the chosen data source are utilized for constructing these queries.

In Alerting, you define a query to get the data you want to measure and a condition that needs to be met before an alert rule fires.

An alert rule consists of one or more queries and expressions that select the data you want to measure.

For more information on queries and expressions, see [Query and transform data][query-transform-data].

## Data source queries

Queries in Grafana can be applied in various ways, depending on the data source and query language being used. Each data source’s query editor provides a customized user interface that helps you write queries that take advantage of its unique capabilities.

Because of the differences between query languages, each data source query editor looks and functions differently. Depending on your data source, the query editor might provide auto-completion features, metric names, variable suggestions, or a visual query-building interface.

Some common types of query components include:

**Metrics or data fields**: Specify the specific metrics or data fields you want to retrieve, such as CPU usage, network traffic, or sensor readings.

**Time range**: Define the time range for which you want to fetch data, such as the last hour, a specific day, or a custom time range.

**Filters**: Apply filters to narrow down the data based on specific criteria, such as filtering data by a specific tag, host, or application.

**Aggregations**: Perform aggregations on the data to calculate metrics like averages, sums, or counts over a given time period.

**Grouping**: Group the data by specific dimensions or tags to create aggregated views or breakdowns.

**Note**:

Grafana does not support alert queries with template variables. More information is available [here](https://community.grafana.com/t/template-variables-are-not-supported-in-alert-queries-while-setting-up-alert/2514).

## Expression queries

In Grafana, an expression is used to perform calculations, transformations, or aggregations on the data source queried data. It allows you to create custom metrics or modify existing metrics based on mathematical operations, functions, or logical expressions.

By leveraging expression queries, users can perform tasks such as calculating the percentage change between two values, applying functions like logarithmic or trigonometric functions, aggregating data over specific time ranges or dimensions, and implementing conditional logic to handle different scenarios.

In Alerting, you can only use expressions for Grafana-managed alert rules. For each expression, you can choose from the math, reduce, and resample expressions. These are called multi-dimensional rules, because they generate a separate alert for each series.

You can also use classic condition, which creates an alert rule that triggers a single alert when its condition is met. As a result, Grafana sends only a single alert even when alert conditions are met for multiple series.

**Note:**

Classic conditions exist mainly for compatibility reasons and should be avoided if possible.

**Reduce**

Aggregates time series values in the selected time range into a single value.

**Math**

Performs free-form math functions/operations on time series and number data. Can be used to preprocess time series data or to define an alert condition for number data.

**Resample**

Realigns a time range to a new set of timestamps, this is useful when comparing time series data from different data sources where the timestamps would otherwise not align.

**Threshold**

Checks if any time series data matches the threshold condition.

The threshold expression allows you to compare two single values. It returns `0` when the condition is false and `1` if the condition is true. The following threshold functions are available:

- Is above (x > y)
- Is below (x < y)
- Is within range (x > y1 AND x < y2)
- Is outside range (x < y1 AND x > y2)

**Classic condition**

Checks if any time series data matches the alert condition.

**Note**:

Classic condition expression queries always produce one alert instance only, no matter how many time series meet the condition.
Classic conditions exist mainly for compatibility reasons and should be avoided if possible.

## Aggregations

Grafana Alerting provides the following aggregation functions to enable you to further refine your query.

These functions are available for **Reduce** and **Classic condition** expressions only.

| Function         | Expression       | What it does                                                                    |
| ---------------- | ---------------- | ------------------------------------------------------------------------------- |
| avg              | Reduce / Classic | Displays the average of the values                                              |
| min              | Reduce / Classic | Displays the lowest value                                                       |
| max              | Reduce / Classic | Displays the highest value                                                      |
| sum              | Reduce / Classic | Displays the sum of all values                                                  |
| count            | Reduce / Classic | Counts the number of values in the result                                       |
| last             | Reduce / Classic | Displays the last value                                                         |
| median           | Reduce / Classic | Displays the median value                                                       |
| diff             | Classic          | Displays the difference between the newest and oldest value                     |
| diff_abs         | Classic          | Displays the absolute value of diff                                             |
| percent_diff     | Classic          | Displays the percentage value of the difference between newest and oldest value |
| percent_diff_abs | Classic          | Displays the absolute value of percent_diff                                     |
| count_non_null   | Classic          | Displays a count of values in the result set that aren't `null`                 |

## Alert condition

An alert condition is the query or expression that determines whether the alert will fire or not depending on the value it yields. There can be only one condition which will determine the triggering of the alert.

After you have defined your queries and/or expressions, choose one of them as the alert rule condition.

When the queried data satisfies the defined condition, Grafana triggers the associated alert, which can be configured to send notifications through various channels like email, Slack, or PagerDuty. The notifications inform you about the condition being met, allowing you to take appropriate actions or investigate the underlying issue.

By default, the last expression added is used as the alert condition.

## Recovery threshold

{{% admonition type="note" %}}
The recovery threshold feature is currently only available in OSS.
{{% /admonition %}}

To reduce the noise of flapping alerts, you can set a recovery threshold different to the alert threshold.

Flapping alerts occur when a metric hovers around the alert threshold condition and may lead to frequent state changes, resulting in too many notifications being generated.

Grafana-managed alert rules are evaluated for a specific interval of time. During each evaluation, the result of the query is checked against the threshold set in the alert rule. If the value of a metric is above the threshold, an alert rule fires and a notification is sent. When the value goes below the threshold and there is an active alert for this metric, the alert is resolved, and another notification is sent.

It can be tricky to create an alert rule for a noisy metric. That is, when the value of a metric continually goes above and below a threshold. This is called flapping and results in a series of firing - resolved - firing notifications and a noisy alert state history.

For example, if you have an alert for latency with a threshold of 1000ms and the number fluctuates around 1000 (say 980 ->1010 -> 990 -> 1020, and so on) then each of those will trigger a notification.

To solve this problem, you can set a (custom) recovery threshold, which basically means having two thresholds instead of one. An alert is triggered when the first threshold is crossed and is resolved only when the second threshold is crossed.

For example, you could set a threshold of 1000ms and a recovery threshold of 900ms. This way, an alert rule will only stop firing when it goes under 900ms and flapping is reduced.

## Alert on numeric data

Among certain data sources numeric data that is not time series can be directly alerted on, or passed into Server Side Expressions (SSE). This allows for more processing and resulting efficiency within the data source, and it can also simplify alert rules.
When alerting on numeric data instead of time series data, there is no need to reduce each labeled time series into a single number. Instead labeled numbers are returned to Grafana instead.

### Tabular Data

This feature is supported with backend data sources that query tabular data:

- SQL data sources such as MySQL, Postgres, MSSQL, and Oracle.
- The Azure Kusto based services: Azure Monitor (Logs), Azure Monitor (Azure Resource Graph), and Azure Data Explorer.

A query with Grafana managed alerts or SSE is considered numeric with these data sources, if:

- The "Format AS" option is set to "Table" in the data source query.
- The table response returned to Grafana from the query includes only one numeric (e.g. int, double, float) column, and optionally additional string columns.

If there are string columns then those columns become labels. The name of column becomes the label name, and the value for each row becomes the value of the corresponding label. If multiple rows are returned, then each row should be uniquely identified their labels.

**Example**

For a MySQL table called "DiskSpace":

| Time        | Host | Disk | PercentFree |
| ----------- | ---- | ---- | ----------- |
| 2021-June-7 | web1 | /etc | 3           |
| 2021-June-7 | web2 | /var | 4           |
| 2021-June-7 | web3 | /var | 8           |
| ...         | ...  | ...  | ...         |

You can query the data filtering on time, but without returning the time series to Grafana. For example, an alert that would trigger per Host, Disk when there is less than 5% free space:

```sql
SELECT Host, Disk, CASE WHEN PercentFree < 5.0 THEN PercentFree ELSE 0 END FROM (
  SELECT
      Host,
      Disk,
      Avg(PercentFree)
  FROM DiskSpace
  Group By
    Host,
    Disk
  Where __timeFilter(Time)
```

This query returns the following Table response to Grafana:

| Host | Disk | PercentFree |
| ---- | ---- | ----------- |
| web1 | /etc | 3           |
| web2 | /var | 4           |
| web3 | /var | 0           |

When this query is used as the **condition** in an alert rule, then the non-zero will be alerting. As a result, three alert instances are produced:

| Labels                | Status   |
| --------------------- | -------- |
| {Host=web1,disk=/etc} | Alerting |
| {Host=web2,disk=/var} | Alerting |
| {Host=web3,disk=/var} | Normal   |

{{% docs/reference %}}
[data-source-alerting]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules#supported-data-sources"
[data-source-alerting]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules#supported-data-sources"

[query-transform-data]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data"
[query-transform-data]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data"
{{% /docs/reference %}}
