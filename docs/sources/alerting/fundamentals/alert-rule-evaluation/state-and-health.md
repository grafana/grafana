---
aliases:
  - ../../fundamentals/alert-rules/state-and-health/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/state-and-health/
  - ../../fundamentals/state-and-health/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/state-and-health/
  - ../../unified-alerting/alerting-rules/state-and-health/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/state-and-health
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rule-evaluation/state-and-health/
description: Learn about the state and health of alert rules to understand several key status indicators about your alerts
keywords:
  - grafana
  - alerting
  - keep last state
  - guide
  - state
labels:
  products:
    - cloud
    - enterprise
    - oss
title: State and health of alerts
weight: 109
refs:
  pending-period:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/#pending-period
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/#pending-period
  no-data-and-error-handling:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/#configure-no-data-and-error-handling
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-grafana-managed-rule/#configure-no-data-and-error-handling
  notifications:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/
---

# State and health of alerts

There are three key components that help you understand how your alerts behave during their evaluation: [alert instance state](#alert-instance-state), [alert rule state](#alert-rule-state), and [alert rule health](#alert-rule-health). Although related, each component conveys subtly different information.

## Alert instance state

An alert instance can be in either of the following states:

| State                    | Description                                                                                                                                                                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Normal**               | The state of an alert when the condition (threshold) is not met.                                                                                                                                                                                                                  |
| **Pending**              | The state of an alert that has breached the threshold but for less than the [pending period](ref:pending-period).                                                                                                                                                                 |
| **Alerting**             | The state of an alert that has breached the threshold for longer than the [pending period](ref:pending-period).                                                                                                                                                                   |
| **No Data<sup>\*</sup>** | The state of an alert whose query returns no data or all values are null. <br/> An alert in this state generates a new [DatasourceNoData alert](#no-data-and-error-alerts). You can [modify the default behavior of the no data state](#modify-the-no-data-or-error-state).       |
| **Error<sup>\*</sup>**   | The state of an alert when an error or timeout occurred evaluating the alert rule. <br/> An alert in this state generates a new [DatasourceError alert](#no-data-and-error-alerts). You can [modify the default behavior of the error state](#modify-the-no-data-or-error-state). |

{{< admonition type="note" >}}

`No Data` and `Error` states are supported only for Grafana-managed alert rules.

{{< /admonition >}}

{{< figure src="/media/docs/alerting/alert-instance-states-v3.png" caption="Alert instance state diagram" alt="A diagram of the distinct alert instance states and transitions." max-width="750px" >}}

### Notification routing

Alert instances will be routed for [notifications](ref:notifications) when they are in the `Alerting` state or have been `Resolved`, transitioning from `Alerting` to `Normal` state.

{{< figure src="/media/docs/alerting/alert-rule-evaluation-overview-statediagram-v2.png" alt="A diagram of the alert instance states and when to route their notifications." max-width="750px" >}}

### `No Data` and `Error` alerts

When evaluation of an alert rule produces state `No Data` or `Error`, Grafana Alerting generates a new alert instance that have the following additional labels:

- `alertname`: Either `DatasourceNoData` or `DatasourceError` depending on the state.
- `datasource_uid`: The UID of the data source that caused the state.

You can manage these alerts like regular ones by using their labels to apply actions such as adding a silence, routing via notification policies, and more.

### Lifecycle of stale alert instances

An alert instance is considered stale if its dimension or series has disappeared from the query results entirely for two evaluation intervals.

Stale alert instances that are in the **Alerting**, **No Data**, or **Error** states transition to the **Normal** state as **Resolved**. Once transitioned, these resolved alert instances are routed for notifications like other resolved alerts.

## Modify the `No Data` or `Error` state

In [Configure no data and error handling](ref:no-data-and-error-handling), you can change the default behaviour when the evaluation returns no data or an error. You can set the alert instance state to `Alerting`, `Normal`, or keep the last state.

Note that `No Data` and `Error` states are supported only for Grafana-managed alert rules.

{{< figure src="/media/docs/alerting/alert-rule-configure-no-data-and-error.png" alt="A screenshot of the `Configure no data and error handling` option in Grafana Alerting." max-width="500px" >}}

{{< docs/shared lookup="alerts/table-configure-no-data-and-error.md" source="grafana" version="<GRAFANA_VERSION>" >}}

Note that when you configure the **No Data** or **Error** behavior to `Alerting` or `Normal`, Grafana attempts to keep a stable set of fields under notification `Values`. If your query returns no data or an error, Grafana re-uses the latest known set of fields in `Values`, but will use `-1` in place of the measured value.

### Reduce `No Data` or `Error` alerts

To minimize the number of **No Data** or **Error** state alerts received, try the following.

1. Use the **Keep last state** option. For more information, refer to the section below. This option allows the alert to retain its last known state when there is no data available, rather than switching to a **No Data** state.
1. For **No Data** alerts, you can optimize your alert rule by expanding the time range of the query. However, if the time range is too big, it affects the performance of the query and can lead to errors due to timeout.

   To minimize timeouts resulting in the **Error** state, reduce the time range to request less data every evaluation cycle.

1. Change the default [evaluation time out](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#evaluation_timeout). The default is set at 30 seconds. To increase the default evaluation timeout, open a support ticket from the [Cloud Portal](https://grafana.com/docs/grafana-cloud/account-management/support/#grafana-cloud-support-options). Note that this should be a last resort, because it may affect the performance of all alert rules and cause missed evaluations if the timeout is too long.

### Keep last state

The "Keep Last State" option helps mitigate temporary data source issues, preventing alerts from unintentionally firing, resolving, and re-firing.

However, in situations where strict monitoring is critical, relying solely on the "Keep Last State" option may not be appropriate. Instead, consider using an alternative or implementing additional alert rules to ensure that issues with prolonged data source disruptions are detected.

## `grafana_state_reason` for troubleshooting

Occasionally, an alert instance may be in a state that isn't immediately clear to everyone. For example:

- Stale alert instances in the `Alerting` state transition to the `Normal` state when the series disappear.
- If "no data" handling is configured to transition to a state other than `No Data`.
- If "error" handling is configured to transition to a state other than `Error`.
- If the alert rule is deleted, paused, or updated in some cases, the alert instance also transitions to the `Normal` state.

In these situations, the evaluation state may differ from the alert state, and it might be necessary to understand the reason for being in that state when receiving the notification.

The `grafana_state_reason` annotation is included in these situations, providing the reason that explains why the alert instance transitioned to its current state. For example:

- Stale alert instances in the `Normal` state include the `grafana_state_reason` annotation with the value **MissingSeries**.
- If "no data" or "error" handling transitions to the `Normal` state, the `grafana_state_reason` annotation is included with the value **No Data** or **Error**, respectively.
- If the alert rule is deleted or paused, the `grafana_state_reason` is set to **Paused** or **RuleDeleted**. For some updates, it is set to **Updated**.

## Alert rule state

The alert rule state is determined by the “worst case” state of the alert instances produced. For example, if one alert instance is `Alerting`, the alert rule state is firing.

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
| **Ok**                 | No error when evaluating an alerting rule.                                                               |
| **Error**              | An error occurred when evaluating an alerting rule.                                                      |
| **No Data**            | The absence of data in at least one time series returned during a rule evaluation.                       |
| **{status}, KeepLast** | The rule would have received another status but was configured to keep the last state of the alert rule. |
