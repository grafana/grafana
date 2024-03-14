---
aliases:
  - ../../alerting/alerting-rules/view-state-health/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/view-state-health
canonical: https://grafana.com/docs/grafana/latest/alerting/manage-notifications/view-state-health/
description: View the state and health of alert rules
keywords:
  - grafana
  - alert rules
  - guide
  - state
  - health
labels:
  products:
    - cloud
    - enterprise
    - oss
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

{{% admonition type="note" %}}
You will need to set the No Data and Error Handling to `No Data` or `Error` in the alert rule as per this doc: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-grafana-managed-rule/#configure-no-data-and-error-handling in order to generate the additional labels.
{{% /admonition %}}

You can handle these alerts the same way as regular alerts by adding a silence, route to a contact point, and so on.

## State history view

Use the State history view to get insight into how your alert instances behave over time. View information on when a state change occurred, what the previous state was, the current state, any other alert instances that changed their state at the same time as well as what the query value was that triggered the change.

{{% admonition type="note" %}}
Open source users must configure alert state history in order to be able to access the view.
{{% /admonition %}}

### View state history

To use the State history view, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Alert rules**.
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
