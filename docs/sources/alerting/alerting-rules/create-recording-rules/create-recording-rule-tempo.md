---
description: Learn how to create a Grafana-managed recording rule for the Tempo data source.
keywords:
  - grafana
  - tempo
  - guide
  - tracing
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Create recording rules for Tempo
title: Create Grafana-managed recording rules for Tempo
weight: 1000
_build:
  list: false
---

# Grafana-managed recording rules for Tempo

## Introduction

Grafana-managed recording rules let you pre-compute query results and store them as new time series metrics. These metrics can then be reused in dashboards, alerts, or downstream queries, improving performance and reliability.

This guide explains how to configure recording rules for the **Tempo data source**. It highlights Tempo-specific considerations, such as TraceQL metrics queries, time range alignment, and evaluation delays.

For background, see [Grafana-managed recording rules](https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/).

## Create a new Tempo recording rule

In Grafana, go to **Alerts & IRM** → **Alerting** → **Alert rules**. From the **More+** menu, select **New Grafana recording rule**.

1. Enter recording rule and metric name.

    - In the **New recording rule** window, configure the following:

    - **Name**: A human-readable identifier for the recording rule.
    - **Metric**: The Prometheus-compatible name of the new metric series that will be generated.
    - **Target data source**:
        - Must be a **Prometheus** data source with *write* permissions (to store the rule’s results).
        - Ensure your Prometheus or Mimir/Loki metrics backend allows Grafana to write the new series.


1. Define the recording rule.

    - **Data source**: Select the **Tempo** data source with *read* permissions.
    - In **Options** select:
        - **Time range**:
            - TraceQL metrics queries are executed as **instant queries** over a window of time.
            - The range you select defines the aggregation window. For example use `from: now-5m` to `now-4m` for a 1-minute recording-rule interval. The Tempo TraceQL query will run over the selected interval.
            - Always include a **delay** of a few minutes (e.g. 2–5 minutes) to account for traces still in flight. This avoids missing late-arriving spans.
        - **Max data points** and **Interval** are not relevant for TraceQL instant queries.
    - **Query**: Enter a valid **TraceQL metrics query**.
        ```
        { service.name = "checkout"}  | count_over_time()
        ```
    - **Expressions**: Typically use **Reduce → Last** to take the most recent computed value.

1. Organize the rule by selecting a **folder** and adding **labels**.

    - Labels can help group or filter rules later.
    - Folders provide UI organization and RBAC scoping.

1. Set evaluation behavior

    Recording rules are executed by evaluation groups at fixed intervals. Align this interval with the query’s time range.

    - **Evaluation interval**: Should equal the size of the query window. For example, if your query covers `now-5m`..`now-4m` (1-minute window with 4-minute delay), use a **1-minute evaluation interval**. This ensures each evaluation produces a new, non-overlapping sample.


## Best practices

- Always include a delay (at least 2 minutes) in the query range to avoid incomplete spans.
- Align the evaluation interval with your query window size.
