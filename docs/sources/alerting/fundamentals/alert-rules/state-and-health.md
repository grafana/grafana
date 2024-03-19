---
aliases:
  - ../../fundamentals/state-and-health/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/state-and-health/
  - ../../unified-alerting/alerting-rules/state-and-health/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/state-and-health
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/state-and-health/
description: Learn about the state and health of alert rules to understand several key status indicators about your alerts
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
title: State and health of alert rules
weight: 109
---

# State and health of alert rules

The state and health of alert rules help you understand several key status indicators about your alerts.

There are three key components: [alert rule state](#alert-rule-state), [alert instance state](#alert-instance-state), and [alert rule health](#alert-rule-health). Although related, each component conveys subtly different information.

## Alert rule state

An alert rule can be in either of the following states:

| State       | Description                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------------- |
| **Normal**  | None of the time series returned by the evaluation engine is in a `Pending` or `Firing` state. |
| **Pending** | At least one time series returned by the evaluation engine is `Pending`.                       |
| **Firing**  | At least one time series returned by the evaluation engine is `Firing`.                        |

{{% admonition type="note" %}}
Alerts will transition first to `pending` and then `firing`, thus it will take at least two evaluation cycles before an alert is fired.
{{% /admonition %}}

## Alert instance state

An alert instance can be in either of the following states:

| State        | Description                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------- |
| **Normal**   | The state of an alert that is neither firing nor pending, everything is working correctly.    |
| **Pending**  | The state of an alert that has been active for less than the configured threshold duration.   |
| **Alerting** | The state of an alert that has been active for longer than the configured threshold duration. |
| **NoData**   | No data has been received for the configured time window.                                     |
| **Error**    | The error that occurred when attempting to evaluate an alert rule.                            |

## Alert rule health

An alert rule can have one the following health statuses:

| State      | Description                                                                        |
| ---------- | ---------------------------------------------------------------------------------- |
| **Ok**     | No error when evaluating an alert rule.                                            |
| **Error**  | An error occurred when evaluating an alert rule.                                   |
| **NoData** | The absence of data in at least one time series returned during a rule evaluation. |

## Special alerts for `NoData` and `Error`

When evaluation of an alert rule produces state `NoData` or `Error`, Grafana Alerting will generate alert instances that have the following additional labels:

| Label              | Description                                                            |
| ------------------ | ---------------------------------------------------------------------- |
| **alertname**      | Either `DatasourceNoData` or `DatasourceError` depending on the state. |
| **datasource_uid** | The UID of the data source that caused the state.                      |

You can handle these alerts the same way as regular alerts by adding a silence, route to a contact point, and so on.
