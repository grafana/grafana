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
  dynamic-threshold-example:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/best-practices/dynamic-thresholds/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/best-practices/dynamic-thresholds/
  alert-instance:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/#alert-instances
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/#alert-instances
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
  math-operation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/expression-queries/#math
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/expression-queries/#math
  resample-operation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/expression-queries/#resample
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/expression-queries/#resample
  reduce-operation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/expression-queries/#reduce
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/expression-queries/#reduce
  table-data-example:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/best-practices/table-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/best-practices/table-data/
---

# Queries and conditions

In Grafana, queries fetch and transform data from data sources, which include databases like MySQL or PostgreSQL, time series databases like Prometheus or InfluxDB, and services like Amazon CloudWatch or Azure Monitor.

An alert rule defines the following components:

- A [query](#data-source-queries) that specifies the data to retrieve from a data source, with the syntax depending on the type of data source used.
- A [condition](#alert-condition) that must be met before the alert rule fires.
- Optional [expressions](#advanced-options-expressions) to perform transformations on the retrieved data.

Alerting periodically runs the queries and expressions, evaluating the condition. If the condition is breached, an alert instance is triggered for each time series.

## Data source queries

Alerting queries are the same as the queries used in Grafana panels, but Grafana-managed alerts are limited to querying [data sources that have Alerting enabled](/grafana/plugins/data-source-plugins/?features=alerting).

Queries in Grafana can be applied in various ways, depending on the data source and query language being used. Each data source’s query editor provides a customized user interface to help you write queries that take advantage of its unique capabilities. For details about query editors and syntax in Grafana, refer to [Query and transform data](ref:query-transform-data).

Alerting can work with two types of data:

1. **Time series data** — The query returns a collection of time series, where each series must be [reduced](#reduce) to a single numeric value for evaluating the alert condition.
1. **Tabular data** — The query must return data in a table format with only one numeric column. Each row must have a value in that column, used to evaluate the alert condition. See a [tabular data example](ref:table-data-example).

Each time series or table row is evaluated as a separate [alert instance](ref:alert-instance).

{{< figure src="/media/docs/alerting/alerting-query-conditions-default-options.png" max-width="750px" caption="Alert query using the Prometheus query editor and alert condition" >}}

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

The following aggregations functions are included: `Min`, `Max`, `Mean`, `Median`, `Sum`, `Count`, and `Last`. For more details, refer to the [Reduce documentation](ref:reduce-operation).

### Math

Performs free-form math functions/operations on time series data and numbers. For example, `$A + 1` or `$A * 100`.

If queries being compared have **multiple series in their results**, series from different queries are matched(joined) if they have the same labels. For example:

{{< docs/shared lookup="alerts/math-example.md" source="grafana" version="<GRAFANA_VERSION>" >}}

In this case, only series with matching labels are joined, and the operation is calculated between them.

For additional scenarios on how Math handles different data types, refer to the [Math documentation](ref:math-operation).

You can also use a Math expression to define the **alert condition**. For example:

- `$B > 70` should fire if the value of B (query or expression) is more than 70.
- `$B < $C * 100` should fire if the value of B is less than the value of C multiplied by 100.
- Compare matching series from two queries, as shown in the [dynamic threshold example](ref:dynamic-threshold-example).

### Resample

Realigns a time range to a new set of timestamps, this is useful when comparing time series data from different data sources where the timestamps would otherwise not align.

For more details, refer to the [Resample documentation](ref:resample-operation).

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

### Recovery threshold

To reduce the noise from flapping alerts, you can set a recovery threshold so that the alert returns to the `Normal` or `Recovering` state only after the recovery threshold is crossed.

Flapping alerts occur when the query value repeatedly crosses above and below the alert threshold, causing frequent state changes. This results in a series of firing-resolved-firing notifications and a noisy alert state history.

For example, if you have an alert for latency with a threshold of 1000ms and the number fluctuates around 1000 (say 980 -> 1010 -> 990 -> 1020, and so on), then each of those might trigger a notification:

- 980 -> 1010 triggers a firing alert.
- 1010 -> 990 triggers a resolving alert.
- 990 -> 1020 triggers a firing alert again.

To prevent this, you can set a recovery threshold to define two thresholds instead of one:

1. An alert transitions to the `Pending` or `Alerting` state when it crosses the alert threshold.
1. It then transitions to the `Recovering` or `Normal` state only when it crosses the recovery threshold.

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
