---
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rule-evaluation/stale-alert-instances/
description: An alert instance is considered stale when its series disappears for a number of consecutive evaluation intervals. Learn how Grafana resolves them.
keywords:
  - grafana
  - alerting
  - guide
  - state
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Stale alert instances
weight: 120
refs:
  no-data-state:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/nodata-and-error-states/#no-data-state
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/nodata-and-error-states/#no-data-state
  no-data-and-error-handling:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/#configure-no-data-and-error-handling
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-grafana-managed-rule/#configure-no-data-and-error-handling
  guide-missing-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/best-practices/missing-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/best-practices/missing-data/
  grafana-state-reason-annotation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/nodata-and-error-states/#grafana_state_reason-for-troubleshooting
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/nodata-and-error-states/#grafana_state_reason-for-troubleshooting
---

# Stale alert instances

An alert instance is considered **stale** if the alert rule query returns data but its dimension (or series) has disappeared for a number of consecutive evaluation intervals (2 by default).

This is different from the [**No Data** state](ref:no-data-state), which occurs when the alert rule query runs successfully but returns no dimensions (or series) at all.

A stale alert instance transitions to the **Normal (MissingSeries)** state as **Resolved**, and is then evicted:

| Eval. Interval   | 1   | 2               | 3                                        | 4   |
| :--------------- | :-- | :-------------- | :--------------------------------------- | :-- |
| Alert instance A | ✔  | ✔              | ✔                                       | ✔  |
| Alert instance B | ✔  | `MissingSeries` | ️`Normal(MissingSeries)` 📩<sup>\*</sup> |     |

{{< admonition type="note" >}}

Stale alert instances are supported only for Grafana-managed alert rules.

{{< /admonition  >}}

## How Grafana handles stale alert instances

The process for handling stale alert instances is as follows:

1. The alert rule runs and returns data for some label sets.

1. An alert instance that previously existed is now missing.

1. Grafana keeps the previous state of the alert instance for the number of evaluation intervals specified in [Missing series evaluations to resolve](#configure-missing-series-evaluations-to-resolve).

1. If it remains missing after the specified number of evaluation intervals (2 by default), it transitions to the **Normal** state and sets **MissingSeries** in the [`grafana_state_reason` annotation](ref:grafana-state-reason-annotation).

   Stale alert instances in the **Alerting**, **No Data**, or **Error** states transition to the **Normal** state as **Resolved**, and are routed for notifications like other resolved alerts.

1. The alert instance is removed from the UI.

{{< admonition type="tip" >}}

For common examples and practical guidance on handling **No Data** and **stale** alert scenarios, see [Handling missing data](ref:guide-missing-data).

{{< /admonition  >}}

## Configure Missing series evaluations to resolve

In [Configure no data and error handling > Missing series evaluations to resolve](ref:no-data-and-error-handling), you can set how many consecutive evaluation intervals must pass without data for a given dimension before the alert instance is marked as stale and resolved.

If you don't specify a value, Grafana uses the **default of 2 evaluation intervals**.
