---
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rule-evaluation/alert-rule-state-and-health/
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
title: Alert rule state and health
weight: 130
refs:
  example-multi-dimensional-alerts:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/best-practices/multi-dimensional-alerts/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/best-practices/multi-dimensional-alerts/
  alert-instance-states:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/nodata-and-error-states/#alert-instance-states
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/nodata-and-error-states/#alert-instance-states
---

# Alert rule state and health

Each alert rule can generate one or more alert instances—one alert instance for each series or dimension, as shown in the [multi-dimensional alert example](ref:example-multi-dimensional-alerts).

Each alert instance of the same alert rule represents a different target and can be in a different state; for example, one alert instance may be **Normal** while another is **Alerting**.

{{< figure src="/media/docs/alerting/alert-rule-example-multiple-alert-instances.png" max-width="750px" alt="Multi dimensional alert rule. The alert rule state and alert rule health are determined by the state of the alert instances." >}}

The alert rule state and alert rule health are determined by the [state of the alert instances](ref:alert-instance-states).

## Alert rule states

An alert rule can be in either of the following states:

| State       | Description                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| **Normal**  | None of the alert instances returned by the evaluation engine is in a `Pending` or `Alerting` state. |
| **Pending** | At least one alert instances returned by the evaluation engine is `Pending`.                         |
| **Firing**  | At least one alert instances returned by the evaluation engine is `Alerting`.                        |

## Alert rule health

An alert rule can have one of the following health statuses:

| State                  | Description                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| **Ok**                 | No error when evaluating the alert rule.                                                                 |
| **Error**              | An error occurred when evaluating the alert rule.                                                        |
| **No Data**            | The alert rule query returns no data.                                                                    |
| **{status}, KeepLast** | The rule would have received another status but was configured to keep the last state of the alert rule. |
