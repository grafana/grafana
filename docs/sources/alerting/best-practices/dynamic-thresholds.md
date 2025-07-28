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
  table-data-example:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/best-practices/table-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/best-practices/table-data/
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

But there's an issue: Grafana supports only **one alert condition per rule**.

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

Grafana evaluates the _Math_ expression **per series**, by joining series from `$A` and `$B` based on their shared labels before applying the expression.

Here’s an example of an arithmetic operation:

{{< docs/shared lookup="alerts/math-example.md" source="grafana" version="<GRAFANA_VERSION>" >}}

In practice, you must align your threshold input with the label sets returned by your alert query.

The following table illustrates how a per-service threshold is evaluated in the previous example:

| $A: p95 latency query        | $B: threshold value            | $C: $A\>$B                   | State      |
| :--------------------------- | :----------------------------- | :--------------------------- | :--------- |
| `{service="checkout-api"} 3` | `{service="checkout-api"} 1.5` | `{service="checkout-api"} 1` | **Firing** |
| `{service="auth-api"} 1`     | `{service="auth-api"} 1.5`     | `{service="auth-api"} 0`     | **Normal** |
| `{service="catalog-api"} 2`  | `{service="catalog-api"} 3`    | `{service="catalog-api"} 0`  | **Normal** |
| `{service="sync-work"} 3`    | `{service="sync-work"} 5`      | `{service="sync-work"} 0`    | **Normal** |

In this example:

- `$A` comes from the `p95_api_latency` query.
- `$B` is manually defined with a threshold value for each series in `$A`.
- The alert condition compares `$A>$B` using a _Math_ relational operator (e.g., `>`, `<`, `>=`, `<=`, `==`, `!=`) that joins series by matching labels.
- Grafana evaluates the alert condition and sets the firing state where the condition is true.

The _Math_ expression works as long as each series in `$A` can be matched with exactly one series in `$B`. They must align in a way that produces a one-to-one match between series in `$A` and `$B`.

{{< admonition type="caution" >}}

If a series in one query doesn’t match any series in the other, it’s excluded from the result and a warning message is displayed:

_1 items **dropped from union(s)**: ["$A > $B": ($B: {service=payment-api})]_

{{< /admonition >}}

**Labels in both series don’t need to be identical**. If labels are a subset of the other, they can join. For example:

- `$A` returns series `{host="web01", job="event"}` 30 and `{host="web02", job="event"}` 20.
- `$B` returns series `{host="web01"}` 10 and `{host="web02"}` 0.
- `$A` + `$B` returns `{host="web01", job="event"}` 40 and `{host="web02", job="event"}` 20.

## Try it with TestData

You can use the [TestData data source](ref:testdata-data-source) to replicate this example:

1. Add the **TestData** data source through the **Connections** menu.
1. Create an alert rule.

   Navigate to **Alerting** → **Alert rules** and click **New alert rule**.

1. Simulate a query (`$A`) that returns latencies for each service.

   Select **TestData** as the data source and configure the scenario.
   - Scenario: Random Walk
   - Alias: latency
   - Labels: service=api-$seriesIndex
   - Series count: 4
   - Start value: 1
   - Min: 1, Max: 4

     This uses `$seriesIndex` to assign unique service labels: `api-0`, `api-1`, etc.

   {{< figure src="/media/docs/alerting/example-dynamic-thresholds-latency-series-v2.png" max-width="750px" alt="TestData data source returns 4 series to simulate latencies for distinct API services." >}}

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

   The `service` column must match the labels from `$A`.

   The `value` column is a numeric value used for the alert comparison.

   For details on CSV format requirements, see [table data examples](ref:table-data-example).

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

   {{< docs/play title="this alert example" url="https://play.grafana.org/alerting/grafana/aep7osljvuku8e/view" >}}

## Other use cases

This example showed how to build a single alert rule with different thresholds per series using [multi-dimensional alerts](ref:multi-dimensional-example) and [Math expressions](ref:math-expression).

This approach scales well when monitoring similar components with distinct reliability goals.

By aligning series from two queries, you can apply a dynamic threshold—one value per label set—without duplicating rules.

While this example uses static CSV content to define thresholds, the same technique works in other scenarios:

- **Dynamic thresholds from queries or recording rules**: Fetch threshold values from a real-time query, or from [custom recording rules](ref:recording-rules).
- **Combine multiple conditions**: Build more advanced threshold logic by combining multiple conditions—such as latency, error rate, or traffic volume.

For example, you can define a PromQL expression that sets a latency threshold which adjusts based on traffic—allowing higher response times during periods of high-load.

```
(
  // Fires when p95 latency > 2s during usual traffic (≤ 1000 req/s)
  service:latency:p95 > 2 and service:request_rate:rate1m <= 1000
)
or
(
  // Fires when p95 latency > 4s during high traffic (> 1000 req/s)
  service:latency:p95 > 4 and service:request_rate:rate1m > 1000
)
```
