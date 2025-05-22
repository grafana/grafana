---
canonical: https://grafana.com/docs/grafana/latest/alerting/best-practices/dynamic-thresholds
description: This example shows how to use a distinct threshold value per dimension using multi-dimensional alerts and a Math expression.
keywords:
  - grafana
  - alerting
  - examples
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Examples of dynamic thresholds
title: Example of dynamic thresholds per dimension
weight: 1103
refs:
  testdata-data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/testdata/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/testdata/
  math-expression:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/queries-conditions/#math
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/queries-conditions/#math
  multi-dimensional-example:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/best-practices/multi-dimensional-alerts/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/best-practices/multi-dimensional-alerts/
  recording-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-recording-rules/
---

# Example of dynamic thresholds per dimension

In Grafana Alerting, each alert rule supports only one condition expression.

That's enough in many cases—most alerts use a fixed numeric threshold like `latency > 3s` or `error_rate > 5%` to determine their state.

As your alerting setup grows, you may find that different targets require different threshold values.

Instead of duplicating alert rules, you can assign a **different threshold value to each target**—while keeping the same condition. This simplifies alert maintenance.

This example shows how to do that using [multi-dimensional alerts](ref:multi-dimensional-example) and a [Math expression](ref:math-expression).

## Example overview

You're monitoring latency across multiple API services. Initially, you want to get alerted if the 95th percentile latency (`p95_api_latency`) exceeds 3 seconds, so your alert rule uses a single static threshold:

```
p95_api_latency > 3
```

But the team quickly finds that some services require stricter thresholds. For example, latency for payment APIs should stay under 1.5s, while background jobs can tolerate up to 5s. The team establishes different thresholds per service:

- `p95_api_latency{service="checkout-api"}`: must stay under `1.5s`.
- `p95_api_latency{service="auth-api"}`: also strict, `1.5s`.
- `p95_api_latency{service="catalog-api"}`: less critical, `3s`.
- `p95_api_latency{service="async-tasks"}`: background jobs can tolerate up to `5s`.

You want to avoid creating one alert rule per service—this is harder to maintain.

In Grafana Alerting, you can define one alert rule that monitors multiple similar components like this scenario. This is called [multi-dimensional alerts](ref:multi-dimensional-example): one alert rule, many alert instances—**one per unique label set**.

But here's the catch: Grafana supports only **one alert condition per rule**.

```
One alert rule
├─ One condition ( e.g., $A > 3)
│  └─ Applies to all returned series in $A
│     ├─ {service="checkout-api"}
│     ├─ {service="auth-api"}
│     ├─ {service="catalog-api"}
│     └─ {service="async-tasks"}
```

To evaluate per-service thresholds, you need a distinct threshold value for each returned series.

## Dynamic thresholds using a Math expression

You can create a dynamic alert condition by operating on two queries with a [Math expression](ref:math-expression).

- `$A` for query results (e.g., `p95_api_latency`).
- `$B` for per-service thresholds (from CSV data or another query).
- `$A > $B` is the _Math_ expression that defines the alert condition.

Grafana evaluates the _Math_ expression **per series**, but only if the label sets in `$A` and `$B` match exactly. That means each series in `$A` must have a corresponding series in `$B` with **identical label values**.

This alignment is required—Grafana joins the series by label set before applying the expression. Here’s an example of an arithmetic operation:

{{< docs/shared lookup="alerts/math-example.md" source="grafana" version="<GRAFANA_VERSION>" >}}

In practice, you must align your threshold input with the label sets returned by your alert query. Each series in the query must have a corresponding **threshold series with identical labels and a threshold value**.

The following table illustrates how a per-service threshold is evaluated in the previous example:

| $A: p95 latency query        | $B: threshold value            | $A\>$B        | Alert State |
| :--------------------------- | :----------------------------- | :------------ | :---------- |
| `{service="checkout-api"} 3` | `{service="checkout-api"} 1.5` | 3\>1.5\=**1** | Firing      |
| `{service="auth-api"} 1`     | `{service="auth-api"} 1.5`     | 1\>1.5\=**0** | Normal      |
| `{service="catalog-api"} 2`  | `{service="catalog-api"} 3`    | 2\>3\=**0**   | Normal      |
| `{service="sync-work"} 3`    | `{service="sync-work"} 5`      | 3\>5\=**0**   | Normal      |

In this example:

- `$A` comes from the `p95_api_latency` query.
- `$B` is manually defined with a threshold value for each series in `$A`.
- The alert condition compares `$A` to `$B` using a _Math_ relational operator (e.g., `>`, `<`, `>=`, `<=`, `==`, `!=`).

As long as both queries return series with matching label sets, Grafana evaluates the expression and triggers alerts where the condition is true.

## Try it with TestData

You can use the [TestData data source](ref:testdata-data-source) to replicate this example:

1. Add the **TestData** data source through the **Connections** menu.
1. Create an alert rule.

   Navigate to **Alerting** → **Alert rules** and click **New alert rule**

1. Simulate a query (`$A`) that returns latencies for each service.

   Select **TestData** as the data source and configure the scenario.

   - Scenario: Random Walk
   - Alias: latency
   - Series count: 4
   - Start value: 1, Max: 4
   - Labels: service=api-$seriesIndex

     This uses `$seriesIndex` to assign unique service labels: `api-0`, `api-1`, etc.

   {{< figure src="/media/docs/alerting/example-dynamic-thresholds-latency-series.png" max-width="750px" alt="TestData data source returns 4 series to simulate latencies for distinct API services." >}}

1. Define per-service thresholds with static data.

   Add a new query (`$B`) and select **TestData** as the data source.

   From **Scenario**, select **CSV Content** and paste this CSV:

   ```
    service,value
    api-0,1.5
    api-1,1.5
    api-2,3
    api-3,5
   ```

   The `service` column must match the labels from `$A`. The `value` column is used for the alert comparison.

1. Add a new **Reduce** expression (`$C`).

   - Type: Reduce
   - Input: A
   - Function: Mean
   - Name: C

   This calculates the average latency for each service: `api-0`, `api-1`, etc.

1. Add a new **Math** expression.

   - Type: Math
   - Expression: `$C > $B`
   - Set this expression as the **alert condition**.

   This fires if the average latency (`$C`) exceeds the threshold from `$B` for any service.

1. **Preview** the alert.

   {{< figure src="/media/docs/alerting/example-dynamic-thresholds-preview-v3.png" max-width="750px" caption="Alert preview evaluating multiple series with distinct threshold values" >}}

## Other use cases

This example showed how to build a single alert rule with different thresholds per series using [multi-dimensional alerts](ref:multi-dimensional-example) and [Math expressions](ref:math-expression).

This approach scales well when monitoring similar components with distinct reliability goals.

By aligning series from two queries, you can apply a dynamic threshold—one value per label set—without duplicating rules.

While this example uses static CSV content to define thresholds, the same technique works in other scenarios:

- **Dynamic thresholds from queries or recording rules**: Fetch threshold values from a real-time query, or from [custom recording rules](ref:recording-rules).
- **Combine multiple conditions**: Build more advanced threshold logic by combining expressions—for example: `latency > 3s && error_rate < 1%`.
