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
---

# State and health of alerts

There are three key components that help you understand how your alerts behave during their evaluation: [alert instance state](#alert-instance-state), [alert rule state](#alert-rule-state), and [alert rule health](#alert-rule-health). Although related, each component conveys subtly different information.

## Alert instance state

An alert instance can be in either of the following states:

| State        | Description                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| **Normal**   | The state of an alert when the condition (threshold) is not met.                                              |
| **Pending**  | The state of an alert that has breached the threshold but for less than the [pending period][pending-period]. |
| **Alerting** | The state of an alert that has breached the threshold for longer than the [pending period][pending-period].   |
| **NoData**   | The state of an alert whose query returns no data or all values are null.                                     |
| **Error**    | The state of an alert when an error or timeout occurred evaluating the alert rule.                            |

{{< figure src="/media/docs/alerting/alert-instance-states-v3.png" caption="Alert instance state diagram" alt="Alert instance state diagram" max-width="750px" >}}

### Notifications

Alert instances will be routed for [notifications][notifications] when they are in the `Alerting` state or have been `Resolved`, transitioning from `Alerting` to `Normal` state.

{{< figure src="/media/docs/alerting/alert-rule-evaluation-overview-statediagram-v2.png" max-width="750px" >}}

### Keep last state

The "Keep Last State" option helps mitigate temporary data source issues, preventing alerts from unintentionally firing, resolving, and re-firing.

In the alert rule settings, you can configure to keep the last state of the alert instance when a `NoData` and/or `Error` state is encountered. Just like normal evaluation, the alert instance transitions from `Pending` to `Alerting` after the pending period has elapsed.

{{< figure src="/media/docs/alerting/alert-rule-configure-no-data-and-error.png" max-width="500px" >}}

However, in situations where strict monitoring is critical, relying solely on the "Keep Last State" option may not be appropriate. Instead, consider using an alternative or implementing additional alert rules to ensure that issues with prolonged data source disruptions are detected.

### Special alerts for `NoData` and `Error`

When evaluation of an alert rule produces state `NoData` or `Error`, Grafana Alerting generates a new alert instance that have the following additional labels:

- `alertname`: Either `DatasourceNoData` or `DatasourceError` depending on the state.
- `datasource_uid`: The UID of the data source that caused the state.

You can manage these alerts like regular ones by using their labels to apply actions such as adding a silence, routing via notification policies, and more.

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
| **NoData**             | The absence of data in at least one time series returned during a rule evaluation.                       |
| **{status}, KeepLast** | The rule would have received another status but was configured to keep the last state of the alert rule. |

{{% docs/reference %}}

[notifications]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications"
[notifications]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications"

[pending-period]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation#pending-period"
[pending-period]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation#pending-period"

{{% /docs/reference %}}
