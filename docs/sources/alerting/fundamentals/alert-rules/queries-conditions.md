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
refs:
  data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/
  data-source-alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/#supported-data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/#supported-data-sources
  alert-rule-evaluation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/
  query-transform-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/
---

# Queries and conditions

In Grafana, queries fetch and transform data from [data sources,](ref:data-sources) which include databases like MySQL or PostgreSQL, time series databases like Prometheus or InfluxDB, and services like Amazon CloudWatch or Azure Monitor.

A query specifies the data to extract from a data source, with the syntax varying based on the type of data source used.

In Alerting, an alert rule defines of one or more queries and expressions that select the data you want to measure and a [condition](#alert-condition) that needs to be met before an alert rule fires.

## Data source queries

Alerting queries are the same type of queries available in Grafana panels. Queries in Grafana can be applied in various ways, depending on the data source and query language being used. However, not all [data sources support Alerting](ref:data-source-alerting).

Each data source’s query editor provides a customized user interface to help you write queries that take advantage of its unique capabilities. For additional information about queries in Grafana, refer to [Query and transform data](ref:query-transform-data).

Some common types of query components include:

**Metrics or data fields**: Specify the specific metrics or data fields you want to retrieve, such as CPU usage, network traffic, or sensor readings.

**Time range**: Define the time range for which you want to fetch data, such as the last hour, a specific day, or a custom time range.

**Filters**: Apply filters to narrow down the data based on specific criteria, such as filtering data by a specific tag, host, or application.

**Aggregations**: Perform aggregations on the data to calculate metrics like averages, sums, or counts over a given time period.

**Grouping**: Group the data by specific dimensions or tags to create aggregated views or breakdowns.

{{% admonition type="note" %}}
Grafana doesn't support alert queries with template variables. More details [here](https://community.grafana.com/t/template-variables-are-not-supported-in-alert-queries-while-setting-up-alert/2514).
{{% /admonition %}}

## Expression queries

In Grafana, an expression is used to perform calculations, transformations, or aggregations on the data source queried data. It allows you to create custom metrics or modify existing metrics based on mathematical operations, functions, or logical expressions.

By leveraging expression queries, users can perform tasks such as calculating the percentage change between two values, applying functions like logarithmic or trigonometric functions, aggregating data over specific time ranges or dimensions, and implementing conditional logic to handle different scenarios.

In Alerting, you can only use expressions for Grafana-managed alert rules. For each expression, you can choose from the math, reduce, and resample expressions. These are called multi-dimensional rules, because they generate an alert instance for each series.

**Reduce**

Aggregates time series values in the selected time range into a single value. It's not necessary for [rules using numeric data](#alert-on-numeric-data).

**Math**

Performs free-form math functions/operations on time series and number data. Can be used to preprocess time series data or to define an alert condition for number data. For example:

- `$B > 70` should fire if the value of B (query or expression) is more than 70.
- `$B < $C * 100` should fire if the value of B is less than the value of C multiplied by 100.

If queries being compared have multiple series in their results, series from different queries are matched if they have the same labels or one is a subset of the other.

**Resample**

Realigns a time range to a new set of timestamps, this is useful when comparing time series data from different data sources where the timestamps would otherwise not align.

**Threshold**

Checks if any time series data matches the threshold condition.

The threshold expression allows you to compare two single values. It returns `0` when the condition is false and `1` if the condition is true. The following threshold functions are available:

- Is above (x > y)
- Is below (x < y)
- Is within range (x > y1 AND x < y2)
- Is outside range (x < y1 AND x > y2)

**Classic condition (legacy)**

Classic conditions exist mainly for compatibility reasons and should be avoided if possible.

Classic condition checks if any time series data matches the alert condition. It always produce one alert instance only, no matter how many time series meet the condition.

| Condition operators | How it works                                                                                                                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| and                 | Two conditions before and after must be true for the overall condition to be true.                                                                                                                                                                          |
| or                  | If one of conditions before and after are true, the overall condition is true.                                                                                                                                                                              |
| logic-or            | If the condition before `logic-or` is true, the overall condition is immediately true, without evaluating subsequent conditions. For instance, `TRUE and TRUE logic-or FALSE and FALSE` evaluate to `TRUE`, because the preceding condition returns `TRUE`. |

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

An alert condition is the query or expression that determines whether the alert fires or not depending on the value it yields. There can be only one condition which determines the triggering of the alert.

After you have defined your queries and expressions, choose one of them as the alert rule condition. By default, the last expression added is used as the alert condition.

When the queried data satisfies the defined condition, Grafana triggers the associated alert, which can be configured to send notifications through various channels like email, Slack, or PagerDuty.

For details about how the alert evaluation triggers notifications, refer to [Alert rule evaluation](ref:alert-rule-evaluation).

## Recovery threshold

To reduce the noise of flapping alerts, you can set a recovery threshold different to the alert threshold.

Flapping alerts occur when a metric hovers around the alert threshold condition and may lead to frequent state changes, resulting in too many notifications being generated.

It can be tricky to create an alert rule for a noisy metric. That is, when the value of a metric continually goes above and below a threshold. This is called flapping and results in a series of firing - resolved - firing notifications and a noisy alert state history.

For example, if you have an alert for latency with a threshold of 1000ms and the number fluctuates around 1000 (say 980 ->1010 -> 990 -> 1020, and so on) then each of those triggers a notification.

To solve this problem, you can set a (custom) recovery threshold, which basically means having two thresholds instead of one:

1. An alert is triggered when the first threshold is crossed.
2. An alert is resolved only when the second threshold is crossed.

For example, you could set a threshold of 1000ms and a recovery threshold of 900ms. This way, an alert rule only stops firing when it goes under 900ms and flapping is reduced.

For details about how the alert evaluation triggers notifications, refer to [Alert rule evaluation](ref:alert-rule-evaluation).

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

When this query is used as the **condition** in an alert rule, then the non-zero is alerting. As a result, three alert instances are produced:

| Labels                | Status   |
| --------------------- | -------- |
| {Host=web1,disk=/etc} | Alerting |
| {Host=web2,disk=/var} | Alerting |
| {Host=web3,disk=/var} | Normal   |
