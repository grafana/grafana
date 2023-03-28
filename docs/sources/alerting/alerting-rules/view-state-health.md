---
aliases:
  - ../fundamentals/state-and-health/
  - ../unified-alerting/alerting-rules/state-and-health/
  - ../view-state-health/
description: State and Health of alerting rules
keywords:
  - grafana
  - alert rules
  - guide
  - state
  - health
title: View the state and health of alert rules
weight: 420
---

# View the state and health of alert rules

The state and health of alert rules helps you understand several key status indicators about your alerts.

There are three key components: [alert rule state](#alert-rule-state), [alert instance state](#alert-instance-state), and [alert rule health](#alert-rule-health). Although related, each component conveys subtly different information.

To view the state and health of your alert rules:

1. In the left-side menu, click **Alerts & incidents** and then **Alerting**.
1. Click **Alert rules** to view the list of existing alerts.
1. Click an alert rule to view its state, health, and state history.

## Alert rule state

An alert rule can be in either of the following states:

| State       | Description                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------------- |
| **Normal**  | None of the time series returned by the evaluation engine is in a `Pending` or `Firing` state. |
| **Pending** | At least one time series returned by the evaluation engine is `Pending`.                       |
| **Firing**  | At least one time series returned by the evaluation engine is `Firing`.                        |

> **Note:** Alerts will transition first to `pending` and then `firing`, thus it will take at least two evaluation cycles before an alert is fired.

## Alert instance state

An alert instance can be in either of the following states:

| State        | Description                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------- |
| **Normal**   | The state of an alert that is neither firing nor pending, everything is working correctly.    |
| **Pending**  | The state of an alert that has been active for less than the configured threshold duration.   |
| **Alerting** | The state of an alert that has been active for longer than the configured threshold duration. |
| **NoData**   | No data has been received for the configured time window.                                     |
| **Error**    | The error that occurred when attempting to evaluate an alerting rule.                         |

## Alert rule health

An alert rule can have one the following health statuses:

| State      | Description                                                                        |
| ---------- | ---------------------------------------------------------------------------------- |
| **Ok**     | No error when evaluating an alerting rule.                                         |
| **Error**  | An error occurred when evaluating an alerting rule.                                |
| **NoData** | The absence of data in at least one time series returned during a rule evaluation. |

## Special alerts for `NoData` and `Error`

When evaluation of an alerting rule produces state `NoData` or `Error`, Grafana Alerting will generate alert instances that have the following additional labels:

| Label              | Description                                                            |
| ------------------ | ---------------------------------------------------------------------- |
| **alertname**      | Either `DatasourceNoData` or `DatasourceError` depending on the state. |
| **datasource_uid** | The UID of the data source that caused the state.                      |

You can handle these alerts the same way as regular alerts by adding a silence, route to a contact point, and so on.
