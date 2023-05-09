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

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
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

## State history view

Use the State history view to get insight into how your alert instances behave over time. View information on when a state change occurred, what the previous state was, the current state, any other alert instances that changed their state at the same time as well as what the query value was that triggered the change.

### Configure the state history view

**Note:** This applies to Open Source only. There is no configuration required if you are using Grafana Cloud.

To enable the state history view, complete the following steps.

1. Ensure you have a Loki instance running to save your history to.
1. Configure the following settings in your Grafana configuration:

   a. Enable the Loki backend and Loki remote URL.

   b. Enable the three feature toggles for alert state history.

**Example:**

```
[unified_alerting.state_history]
enabled = true
backend = loki
loki_remote_url = http://localhost:3100

[feature_toggles]
enable = alertStateHistoryLokiSecondary, alertStateHistoryLokiPrimary, alertStateHistoryLokiOnly
```

### View state history

To use the State history view, complete the following steps.

1. Navigate to **Alerts&IRM** -> **Alerting** -> **Alert rules**.
1. Click an alert rule.
1. Select **Show state history**.

   The State history view opens.

   The timeline view at the top displays a timeline of changes for the past hour, so you can track how your alert instances are behaving over time.

   The bottom part shows the alert instances, their previous and current state, the value of each part of the expression and a unique set of labels.

   Common labels are displayed at the top to make it easier to identify different alert instances.

1. From the timeline view, hover over a time to get an automatic display of all the changes that happened at that particular moment.

   These changes are displayed in real time in the timestamp view at the bottom of the page. The timestamp view is a list of all the alert instances that changed state at that point in time. The visualization only displays 12 instances by default.

   The value shown for each instance is for each part of the expression that was evaluated.

1. Click the labels to filter and narrow down the results.
