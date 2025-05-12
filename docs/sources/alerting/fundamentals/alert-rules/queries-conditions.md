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
  data-source-alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/#supported-data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/#supported-data-sources
  state-and-health:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/state-and-health/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/state-and-health/
  query-transform-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/
---

# Queries and conditions

In Grafana, queries fetch and transform data from data sources, which include databases like MySQL or PostgreSQL, time series databases like Prometheus or InfluxDB, and services like Amazon CloudWatch or Azure Monitor.

An alert rule defines the following components:

- A [query](#data-source-queries) that specifies the data to retrieve from a data source, with the syntax depending on the type of data source used.
- A [condition](#alert-condition) that must be met before the alert rule fires.
- Optional [expressions](#advanced-options-expressions) to perform transformations on the retrieved data.

Alerting periodically runs the queries and expressions, evaluating the condition. If the condition is breached, an alert instance is triggered for each time series.

## Data source queries

Alerting queries are the same as the queries used in Grafana panels, but Grafana-managed alerts are limited to querying [data sources that have Alerting enabled](ref:data-source-alerting).

Queries in Grafana can be applied in various ways, depending on the data source and query language being used. Each data source’s query editor provides a customized user interface to help you write queries that take advantage of its unique capabilities.

For more details about queries in Grafana, refer to [Query and transform data](ref:query-transform-data).

{{< figure src="/media/docs/alerting/alerting-query-conditions-default-options.png" max-width="750px" caption="Define alert query and alert condition" >}}

## Alert condition

The alert condition is the query or expression that determines whether the alert fires or not depending whether the value satisfies the specified comparison. There can be only one condition which determines the triggering of the alert.

If the queried data meets the defined condition, Grafana fires the alert.

When using **Default options**, the `When` input [reduces the query data](#reduce), and the last input defines the threshold condition.

When using **Advanced options**, you have to choose one of your queries or expressions as the alert condition.

## Advanced options: Expressions

Expressions are only available for Grafana-managed alerts and when the **Advanced options** are enabled.

In Grafana, expressions allow you to perform calculations, transformations, or aggregations on queried data. They modify existing metrics through mathematical operations, functions, or logical expressions.

With expression queries, you can perform tasks such as calculating the percentage change between two values, applying functions like logarithmic or trigonometric functions, aggregating data over specific time ranges or dimensions, and implementing conditional logic to handle different scenarios.

{{< figure src="/media/docs/alerting/alert-rule-expressions.png" max-width="750px" caption="Alert rule expressions" >}}

The following expressions are available:

### Reduce

Aggregates time series values within the selected time range into a single number.

Reduce takes one or more time series and transform each series into a single number, which can then be compared in the alert condition.

The following aggregations functions are included: `Min`, `Max`, `Mean`, `Mediam`, `Sum`, `Count`, and `Last`.

### Math

Performs free-form math functions/operations on time series data and numbers. For instance, `$A + 1` or `$A * 100`.

You can also use a Math expression to define the alert condition for numbers. For example:

- `$B > 70` should fire if the value of B (query or expression) is more than 70.
- `$B < $C * 100` should fire if the value of B is less than the value of C multiplied by 100.

If queries being compared have multiple series in their results, series from different queries are matched if they have the same labels or one is a subset of the other.

### Resample

Realigns a time range to a new set of timestamps, this is useful when comparing time series data from different data sources where the timestamps would otherwise not align.

### Threshold

Compares single numbers from previous queries or expressions (e.g., `$A`, `$B`) to a specified condition. It's often used to define the alert condition.

The threshold expression allows the comparison between two single values. Available threshold functions are:

- **Is above**: `$A > 5`
- **Is below**: `$B < 3`
- **Is equal to**: `$A == 2`
- **Is not equal to**: `$B =! 4`
- **Is above or equal to**: `$A >= 8`
- **Is below or equal to**: `$B <= 16`
- **Is within range**: `$A > 0 AND $A < 10`
- **Is outside range**: `$B < 0 OR $B > 100`
- **Is within range included**: `$A >= 0 AND $A <= 10`
- **Is outside range included**: `$B <= 0 OR $B >= 100`

A threshold returns `0` when the condition is false and `1` when true.

If the threshold is set as the alert condition, the alert fires when the threshold returns `1`.

#### Recovery threshold

To reduce the noise from flapping alerts, you can set a recovery threshold different to the alert threshold.

Flapping alerts occur when a metric hovers around the alert threshold condition and may lead to frequent state changes, resulting in too many notifications.

The value of a flapping metric can continually go above and below a threshold, resulting in a series of firing-resolved-firing notifications and a noisy alert state history.

For example, if you have an alert for latency with a threshold of 1000ms and the number fluctuates around 1000 (say 980 -> 1010 -> 990 -> 1020, and so on), then each of those might trigger a notification:

- 980 -> 1010 triggers a firing alert.
- 1010 -> 990 triggers a resolving alert.
- 990 -> 1020 triggers a firing alert again.

To prevent this, you can set a recovery threshold to define two thresholds instead of one:

1. An alert is triggered when the first threshold is crossed.
1. An alert is resolved only when the second (recovery) threshold is crossed.

In the previous example, setting the recovery threshold to 900ms means the alert only resolves when the latency falls below 900ms:

- 980 -> 1010 triggers a firing alert.
- 1010 -> 990 does not resolve the alert, keeping it in the firing state.
- 990 -> 1020 keeps the alert in the firing state.

The recovery threshold mitigates unnecessary alert state changes and reduces alert noise.

{{< collapse title="Classic condition (legacy)" >}}

#### Classic condition (legacy)

Classic conditions exist mainly for compatibility reasons and should be avoided if possible.

Classic condition checks if any time series data matches the alert condition. It always produce one alert instance only, no matter how many time series meet the condition.

| Condition operators | How it works                                                                                                                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `and`               | Two conditions before and after must be true for the overall condition to be true.                                                                                                                                                                          |
| `or`                | If one of conditions before and after are true, the overall condition is true.                                                                                                                                                                              |
| `logic-or`          | If the condition before `logic-or` is true, the overall condition is immediately true, without evaluating subsequent conditions. For instance, `TRUE and TRUE logic-or FALSE and FALSE` evaluate to `TRUE`, because the preceding condition returns `TRUE`. |

The following aggregation functions are also available to further refine your query.

| Function           | What it does                                                                    |
| ------------------ | ------------------------------------------------------------------------------- |
| `avg`              | Displays the average of the values                                              |
| `min`              | Displays the lowest value                                                       |
| `max`              | Displays the highest value                                                      |
| `sum`              | Displays the sum of all values                                                  |
| `count`            | Counts the number of values in the result                                       |
| `last`             | Displays the last value                                                         |
| `median`           | Displays the median value                                                       |
| `diff`             | Displays the difference between the newest and oldest value                     |
| `diff_abs`         | Displays the absolute value of diff                                             |
| `percent_diff`     | Displays the percentage value of the difference between newest and oldest value |
| `percent_diff_abs` | Displays the absolute value of `percent_diff`                                   |
| `count_non_null`   | Displays a count of values in the result set that aren't `null`                 |

{{< /collapse >}}

## Alert on numeric data

Among certain data sources numeric data that is not time series can be directly alerted on, or passed into Server Side Expressions (SSE). This allows for more processing and resulting efficiency within the data source, and it can also simplify alert rules.
When alerting on numeric data instead of time series data, there is no need to [reduce](#reduce) each labeled time series into a single number. Instead labeled numbers are returned to Grafana instead.

#### Tabular Data

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
