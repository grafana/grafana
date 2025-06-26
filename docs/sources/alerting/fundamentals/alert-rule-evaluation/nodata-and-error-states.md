---
aliases:
  - ../../fundamentals/alert-rule-evaluation/state-and-health/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/state-and-health/
  - ../../fundamentals/alert-rules/state-and-health/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/state-and-health/
  - ../../fundamentals/state-and-health/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/state-and-health/
  - ../../unified-alerting/alerting-rules/state-and-health/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/state-and-health
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rule-evaluation/nodata-and-error-states/
description: Grafana Alerting implements the No Data and Error states to handle these common scenarios when evaluating alert rules.
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
title: No Data and Error states
weight: 109
refs:
  evaluation_timeout:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#evaluation_timeout
  max_attempts:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#max_attempts
  stale-alert-instances:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/stale-alert-instances/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/stale-alert-instances/
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
  keep-firing:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/#keep-firing-for
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/#keep-firing-for
  notifications:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/
  notification-policies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/notification-policies/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/notification-policies/
  guide-connectivity-errors:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/best-practices/connectivity-errors/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/best-practices/connectivity-errors/
  guide-missing-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/best-practices/missing-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/best-practices/missing-data/
---

# No Data and Error states

Grafana Alerting implements the **No Data** and **Error** states to handle common scenarios when evaluating alert rules, and you can modify their behavior.

An alert instance can transition to these special states:

- [No Data state](#no-data-state) occurs when the alert rule query runs successfully but returns no data points.
- [Error state](#error-state) occurs when the alert rule fails to evaluate its query or queries successfully.

{{< admonition type="note" >}}

No Data and Error states are supported only for Grafana-managed alert rules.

{{< /admonition  >}}

{{< admonition type="tip" >}}
For common examples and practical guidance on handling **Error**, **No Data**, and **stale** alert scenarios, refer to the [Handle connectivity errors](ref:guide-connectivity-errors) and [Handle missing data](ref:guide-missing-data) guides.
{{< /admonition  >}}

## Alert instance states

A Grafana-managed alert instance can be in any of the following states, depending on the outcome of the alert rule evaluation:

| State                    | Description                                                                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Normal**               | The state of an alert when the condition (threshold) is not met.                                                                                                                                         |
| **Pending**              | The state of an alert that has breached the threshold but for less than the [pending period](ref:pending-period).                                                                                        |
| **Alerting**             | The state of an alert that has breached the threshold for longer than the [pending period](ref:pending-period).                                                                                          |
| **Recovering**           | The state of a firing alert when the threshold is no longer breached, but for less than the [keep firing for](ref:keep-firing) period.                                                                   |
| **Error<sup>\*</sup>**   | The state of an alert when an error or timeout occurred evaluating the alert rule. <br/> You can customize the behavior of the [Error state](#error-state), which by default triggers a different alert. |
| **No Data<sup>\*</sup>** | The state of an alert whose query returns no data or all values are null. <br/> You can customize the behavior of the [No Data state](#no-data-state), which by default triggers a different alert.      |

{{< figure src="/media/docs/alerting/alert-state-diagram2.png" caption="Alert instance state diagram" alt="A diagram of the distinct alert instance states and transitions." max-width="750px" >}}

## `Error` state

The **Error** state is triggered when the alert rule fails to evaluate its query or queries successfully.

This can occur due to evaluation timeouts (default: `30s`) or three repeated failures when querying the data source. The [`evaluation_timeout`](ref:evaluation_timeout) and [`max_attempts`](ref:max_attempts) options control these settings.

When an alert instance enters the **Error** state, Grafana, by default, triggers a new [`DatasourceError` alert](#no-data-and-error-alerts). You can control this behavior based on the desired outcome of your alert rule in [Modify the `No Data` or `Error` state](#modify-the-no-data-or-error-state).

## `No Data` state

The **No Data** state occurs when the alert rule query runs successfully but returns no data points at all.

When an alert instance enters the **No Data** state, Grafana, by default, triggers a new [`DatasourceNoData` alert](#no-data-and-error-alerts). You can control this behavior based on the desired outcome of your alert rule in [Modify the `No Data` or `Error` state](#modify-the-no-data-or-error-state).

## Modify the `No Data` or `Error` state

These states are supported only for Grafana-managed alert rules.

In [Configure no data and error handling](ref:no-data-and-error-handling), you can change the default behavior when the evaluation returns no data or an error. You can set the alert instance state to `Alerting`, `Normal`, `Error`, or `Keep Last State`.

{{< figure src="/media/docs/alerting/alert-rule-configure-no-data-and-error-v2.png" alt="A screenshot of the `Configure no data and error handling` option in Grafana Alerting." max-width="500px" >}}

{{< docs/shared lookup="alerts/table-configure-no-data-and-error.md" source="grafana" version="<GRAFANA_VERSION>" >}}

Note that when you configure the **No Data** or **Error** behavior to `Alerting` or `Normal`, Grafana attempts to keep a stable set of fields under notification `Values`. If your query returns no data or an error, Grafana re-uses the latest known set of fields in `Values`, but will use `-1` in place of the measured value.

### Keep last state

The "Keep Last State" option helps mitigate temporary data source issues, preventing alerts from unintentionally firing, resolving, and re-firing.

However, in situations where strict monitoring is critical, relying solely on the "Keep Last State" option may not be appropriate. Instead, consider using an alternative or implementing additional alert rules to ensure that issues with prolonged data source disruptions are detected.

### `No Data` and `Error` alerts

When an alert rule evaluation results in a `No Data` or `Error` state, Grafana Alerting immediately creates a new alert instance —skipping the pending period—with the following additional labels:

- `alertname`: Either `DatasourceNoData` or `DatasourceError` depending on the state.
- `datasource_uid`: The UID of the data source that caused the state.
- `rulename`: The name of the alert rule that originated the alert.

Note that `DatasourceNoData` and `DatasourceError` alert instances are independent from the original alert instance. They have different labels, which means existing silences, mute timings, and notification policies applied to the original alert may not apply to them.

You can manage these alerts like regular ones by using their labels to apply actions such as adding a silence, routing via notification policies, and more.

If the alert rule is configured to send notifications directly to a selected contact point (instead of using notification policies), the `DatasourceNoData` and `DatasourceError` alerts are also sent to that contact point. Any additional notification settings defined in the alert rule, such as muting or grouping, are preserved.

### Reduce `No Data` or `Error` alerts

To minimize the number of **No Data** or **Error** state alerts received, try the following.

1. Use the **Keep last state** option. For more information, refer to the section below. This option allows the alert to retain its last known state when there is no data available, rather than switching to a **No Data** state.
1. For **No Data** alerts, you can optimize your alert rule by expanding the time range of the query. However, if the time range is too big, it affects the performance of the query and can lead to errors due to timeout.

   To minimize timeouts resulting in the **Error** state, reduce the time range to request less data every evaluation cycle.

1. Change the default [evaluation time out](ref:evaluation_timeout). The default is set at 30 seconds. To increase the default evaluation timeout, open a support ticket from the [Cloud Portal](https://grafana.com/docs/grafana-cloud/account-management/support/#grafana-cloud-support-options). Note that this should be a last resort, because it may affect the performance of all alert rules and cause missed evaluations if the timeout is too long.

1. To reduce multiple notifications from **Error** alerts, define a [notification policy](ref:notification-policies) to handle all related alerts with `alertname=DatasourceError`, and filter and group errors from the same data source using the `datasource_uid` label.

   {{< admonition type="tip" >}}
   For common examples and practical guidance on handling **Error**, **No Data**, and **stale** alert scenarios, refer to the [Handle connectivity errors](ref:guide-connectivity-errors) and [Handle missing data](ref:guide-missing-data) guides.
   {{< /admonition  >}}

## `grafana_state_reason` for troubleshooting

Occasionally, an alert instance may be in a state that isn't immediately clear to everyone. For example:

- If "no data" handling is configured to transition to a state other than `No Data`.
- If "error" handling is configured to transition to a state other than `Error`.
- If the alert rule is deleted, paused, or updated in some cases, the alert instance also transitions to the `Normal` state.
- [Stale alert instances](ref:stale-alert-instances) in the `Alerting` state transition to the `Normal` state when the series disappear.

In these situations, the evaluation state may differ from the alert state, and it might be necessary to understand the reason for being in that state when receiving the notification.

The `grafana_state_reason` annotation is included in these situations, providing the reason that explains why the alert instance transitioned to its current state. For example:

- If "no data" or "error" handling transitions to the `Normal` state, the `grafana_state_reason` annotation is included with the value **No Data** or **Error**, respectively.
- If the alert rule is deleted or paused, the `grafana_state_reason` is set to **Paused** or **RuleDeleted**. For some updates, it is set to **Updated**.
- [Stale alert instances](ref:stale-alert-instances) in the `Normal` state include the `grafana_state_reason` annotation with the value **MissingSeries**.
