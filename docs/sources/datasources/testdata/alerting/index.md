---
description: Use TestData with Grafana Alerting to prototype and test alert rules without an external data source.
keywords:
  - grafana
  - testdata
  - alerting
  - alerts
  - testing
  - prototype
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Alerting
title: TestData alerting
weight: 400
review_date: "2026-04-08"
---

# TestData alerting

The TestData data source supports [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/). You can use it to prototype alert rules, test threshold conditions, and verify notification pipelines without connecting to an external data source.

## Before you begin

- [Configure the TestData data source](../configure/).
- Familiarize yourself with [alert rules](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/) and how to [create a Grafana-managed alert rule](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/).

## Choose a scenario for alerting

TestData scenarios that return time-series data work with alert rule conditions. Choose a scenario based on the behavior you want to test.

| Scenario                   | Alerting use case                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| **Predictable Pulse**      | Deterministic on/off pattern. Produces repeatable alert firing and resolving on a fixed cycle. |
| **Random Walk**            | Non-deterministic time series. Useful for quick prototyping and load testing alert evaluation. |
| **CSV Metric Values**      | Controlled, fixed values. Test exact threshold boundaries.                                    |
| **Predictable CSV Wave**   | Custom repeating waveforms. Test complex threshold patterns with precise control.             |
| **Random Walk (with error)** | Returns both data and an error. Test how alerts handle partial failures.                     |
| **Error with source**      | Returns a plugin or downstream error. Test alert evaluation error handling.                   |
| **No Data Points**         | Returns empty results. Test no-data alert conditions.                                         |
| **Slow Query**             | Introduces a configurable delay. Test alert evaluation timeouts.                              |

Scenarios that produce logs, traces, or streaming data aren't suitable for threshold-based alert conditions.

## Create an alert rule

To create an alert rule using TestData:

1. Navigate to **Alerting** > **Alert rules**.
1. Click **New alert rule**.
1. Enter a name for the rule.
1. Select the **TestData** data source.
1. Choose a scenario from the **Scenario** drop-down (for example, **Predictable Pulse**).
1. Configure the scenario options.
1. Add a **Reduce** expression to aggregate the series (for example, **Last** value).
1. Add a **Threshold** expression to define the condition (for example, **Is above** `0.5`).
1. Set the evaluation interval and pending period.
1. Configure notifications and labels.
1. Click **Save rule**.

For detailed instructions, refer to [Create a Grafana-managed alert rule](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/).

## Example: Predictable Pulse alert

The Predictable Pulse scenario produces a repeating on/off wave that's ideal for testing alert rules because the firing pattern is deterministic and reproducible.

To create a Predictable Pulse alert:

1. Select the **Predictable Pulse** scenario.
1. Configure the pulse options:

   | Field         | Value | Effect                                            |
   | ------------- | ----- | ------------------------------------------------- |
   | **Step**      | `60`  | One data point every 60 seconds.                  |
   | **On Count**  | `3`   | Three consecutive points at the "on" value.       |
   | **Off Count** | `6`   | Six consecutive points at the "off" value.        |
   | **On Value**  | `1`   | Value during the "on" phase.                      |
   | **Off Value** | `0`   | Value during the "off" phase.                     |

1. Add a **Reduce** expression with function **Last**.
1. Add a **Threshold** expression: **Is above** `0.5`.

With this configuration, the alert fires for 3 minutes (3 x 60s on-points) and then resolves for 6 minutes (6 x 60s off-points), repeating indefinitely. Adjust the step, on count, and off count to control the timing.

## Test error and no-data conditions

TestData includes scenarios designed for testing how alerts respond to failures.

- **No Data Points:** Returns an empty result. Use this to verify your alert rule's **no data** handling (for example, configuring the rule to alert, keep the last state, or resolve when no data is received).
- **Random Walk (with error):** Returns data alongside an error. Use this to test how alert evaluation handles responses with both valid data and errors.
- **Error with source:** Returns only an error, classified as either a **plugin** error or a **downstream** error. Use this to verify error-state behavior in alert rules.
- **Slow Query:** Introduces a delay (default `5s`). Use this to test alert evaluation timeouts by setting a duration longer than the evaluation interval.

## Limitations

When using TestData with Grafana Alerting, be aware of the following limitations.

### Template variables aren't supported in alert queries

Grafana evaluates alert rules on the backend without dashboard context. Template variables like `$varname` aren't resolved during alert evaluation. Use fixed values in the scenario options instead.

### Only time-series scenarios work with alert conditions

Alert conditions require numeric time-series data. Scenarios that produce logs (Logs), traces (Trace), graphs (Node Graph, Flame Graph), annotations (Annotations), or tables (Table Static) can't be used as alert conditions.

### Streaming scenarios aren't evaluated by the alerting engine

The alerting engine evaluates queries at fixed intervals and doesn't consume streaming data. Avoid using Streaming Client, Grafana Live, or Simulation with streaming enabled for alert rules.
