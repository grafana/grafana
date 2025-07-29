---
canonical: https://grafana.com/docs/grafana/latest/alerting/best-practices/multi-dimensional-alerts/
description: This example shows how a single alert rule can generate multiple alert instances using time series data.
keywords:
  - grafana
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Examples of multi-dimensional alerts
title: Example of multi-dimensional alerts on time series data
weight: 1101
refs:
  testdata-data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/testdata/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/testdata/
  table-data-example:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/best-practices/table-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/best-practices/table-data/
  annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/#annotations
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/#annotations
  reduce-expression:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/queries-conditions/#reduce
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/queries-conditions/#reduce
  alert-grouping:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/group-alert-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/group-alert-notifications/
---

# Example of multi-dimensional alerts on time series data

This example shows how a single alert rule can generate multiple alert instances — one for each label set (or time series). This is called **multi-dimensional alerting**: one alert rule, many alert instances.

In Prometheus, each unique combination of labels defines a distinct time series. Grafana Alerting uses the same model: each label set is evaluated independently, and a separate alert instance is created for each series.

This pattern is common in dynamic environments when monitoring a group of components like multiple CPUs, containers, or per-host availability. Instead of defining individual alert rules or aggregated alerts, you alert on _each dimension_ — so you can detect particular issues and include that level of detail in notifications.

For example, a query returns one series per CPU:

| `cpu` label value | CPU percent usage |
| :---------------- | :---------------- |
| cpu-0             | 95                |
| cpu-1             | 30                |
| cpu-2             | 85                |

With a threshold of `> 80`, this would trigger two alert instances for `cpu-0` and one for `cpu-2`.

## Examples overview

Imagine you want to trigger alerts when CPU usage goes above 80%, and you want to track each CPU core independently.

You can use a Prometheus query like this:

```
sum by(cpu) (
  rate(node_cpu_seconds_total{mode!="idle"}[1m])
)
```

This query returns the active CPU usage rate per CPU core, averaged over the past minute.

| CPU core | Active usage rate |
| :------- | :---------------- |
| cpu-0    | 95                |
| cpu-1    | 30                |
| cpu-2    | 85                |

This produces one series for each existing CPU.

When Grafana Alerting evaluates the query, it creates an individual alert instance for each returned series.

| Alert instance | Value |
| :------------- | :---- |
| {cpu="cpu-0"}  | 95    |
| {cpu="cpu-1"}  | 30    |
| {cpu="cpu-2"}  | 85    |

With a threshold condition like `$A > 80`, Grafana evaluates each instance separately and fires alerts only where the condition is met:

| Alert instance | Value | State  |
| :------------- | :---- | :----- |
| {cpu="cpu-0"}  | 95    | Firing |
| {cpu="cpu-1"}  | 30    | Normal |
| {cpu="cpu-2"}  | 85    | Firing |

Multi-dimensional alerts help you surface issues on individual components—problems that might be missed when alerting on aggregated data (like total CPU usage).

Each alert instance targets a specific component, identified by its unique label set. This makes alerts more specific and actionable. For example, you can set a [`summary` annotation](ref:annotations) in your alert rule that identifies the affected CPU:

```
High CPU usage on {{$labels.cpu}}
```

In the previous example, the two firing alert instances would display summaries indicating the affected CPUs:

- High CPU usage on `cpu-0`
- High CPU usage on `cpu-2`

## Try it with TestData

You can quickly experiment with multi-dimensional alerts using the [**TestData** data source](ref:testdata-data-source), which can generate multiple random time series.

1. Add the **TestData** data source through the **Connections** menu.
1. Go to **Alerting** and create an alert rule
1. Select **TestData** as the data source.
1. Configure the TestData scenario
   - Scenario: **Random Walk**
   - Labels: `cpu=cpu-$seriesIndex`
   - Series count: 3
   - Min: 70, Max: 100
   - Spread: 2

   {{< figure src="/media/docs/alerting/testdata-random-series-v2.png" max-width="750px" alt="Generating random time series data using the TestData data source" >}}

## Reduce time series data for comparison

The example returns three time series like shown above with values across the selected time range.

To alert on each series, you need to reduce the time series to a single value that the alert condition can evaluate and determine the alert instance state.

Grafana Alerting provides several ways to reduce time series data:

- **Data source query functions**. The earlier example used the Prometheus `sum` function to sum the rate results by `cpu,`producing a single value per CPU core.
- **Reduce expression**. In the query and condition section, Grafana provides the `Reduce` expression to aggregate time series data.
  - In **Default mode**, the **When** input selects a reducer (like `last`, `mean`, or `min`), and the threshold compares that reduced value.
  - In **Advanced mode**, you can add the [**Reduce** expression](ref:reduce-expression) (e.g., `last()`, `mean()`) before defining the threshold (alert condition).

For demo purposes, this example uses the **Advanced mode** with a **Reduce** expression:

1. Toggle **Advanced mode** in the top right section of the query panel to enable adding additional expressions.
1. Add the **Reduce** expression using a function like `mean()` to reduce each time series to a single value.
1. Define the alert condition using a **Threshold** like `$reducer > 80`
1. Click **Preview** to evaluate the alert rule.

   {{< figure src="/media/docs/alerting/using-expressions-with-multiple-series.png" max-width="750px" caption="The alert condition evaluates the reduced value for each alert instance and shows whether each instance is Firing or Normal." alt="Alert preview using a Reduce expression and a threshold condition" >}}

   {{< docs/play title="this alert example" url="https://play.grafana.org/alerting/grafana/dep7osljedaf4a/view" >}}

## Learn more

This example shows how Grafana Alerting implements a multi-dimensional alerting model: one rule, many alert instances and why reducing time series data to a single value is required for evaluation.

For additional learning resources, check out:

- [Get started tutorial – Create multi-dimensional alerts and route them](https://grafana.com/tutorials/alerting-get-started-pt2/)
- [Example of alerting on tabular data](ref:table-data-example)
  Update the interval of a rule group or modify the rules of the group.
