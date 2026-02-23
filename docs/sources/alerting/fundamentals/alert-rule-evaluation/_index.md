---
aliases:
  - ../fundamentals/alert-rules/rule-evaluation/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/rule-evaluation/
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rule-evaluation/
description: Use alert rule evaluation to determine how frequently an alert rule should be evaluated and how quickly it should change its state
keywords:
  - grafana
  - alerting
  - evaluation
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Alert rule evaluation
weight: 108
refs:
  evaluation-within-a-group:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/evaluation-within-a-group/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/evaluation-within-a-group/
  nodata-and-error-states:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/nodata-and-error-states/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/nodata-and-error-states/
  import-ds-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/alerting-migration/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/alerting-migration/
  notifications:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/
---

# Alert rule evaluation

The criteria determining when an alert rule fires are based on three settings:

- [Evaluation group](#evaluation-group): how frequently the alert rule is evaluated.
- [Pending period](#pending-period): how long the condition must be met to start firing.
- [Keep firing for](#pending-period): how long the alert continues to fire after the condition is no longer met.

  {{< figure src="/media/docs/alerting/alert-rule-evaluation-2.png" max-width="750px" alt="Set the evaluation behavior of the alert rule in Grafana." caption="Set alert rule evaluation" >}}

These settings affect how alert instances progress through their lifecycle.

## Alerting lifecycle

Each alert rule can generate one or more alert instances.

An alert instance transitions between these common states based on how long the alert condition remains met or not met.

| State          | Description                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Normal**     | The state of an alert when the condition (threshold) is not met.                                                                        |
| **Pending**    | The state of an alert that has breached the threshold but for less than the [pending period](#pending-period).                          |
| **Alerting**   | The state of an alert that has breached the threshold for longer than the [pending period](#pending-period).                            |
| **Recovering** | The state of a firing alert when the threshold is no longer breached, but for less than the [keep firing for](#keep-firing-for) period. |

{{< figure src="/media/docs/alerting/alert-rule-evaluation-basic-statediagram.png" alt="A diagram of the lifecyle of a firing alert instance." max-width="750px" >}}

If an alert rule changes (except for updates to annotations, the evaluation interval, or other internal fields), its alert instances reset to the **Normal** state, and update accordingly during the next evaluation.

{{< admonition type="note" >}}

To learn about additional alert instance states, see [No Data and Error states](ref:nodata-and-error-states).

{{< /admonition >}}

## Notification routing

Alert instances are routed for [notifications](ref:notifications) in two scenarios:

1. When they transition to the **Alerting** state.
2. When they transition to **Normal** state and marked as `Resolved`, either from the **Alerting** or **Recovering** state.

## Evaluation group

{{< shared id="evaluation-group-basics" >}}

Every alert rule and recording rule is assigned to an evaluation group. Each evaluation group contains an **evaluation interval** that determines how frequently the rule is checked. For instance, the evaluation may occur every `10s`, `30s`, `1m`, `10m`, etc.

{{< /shared >}}

Rules can be evaluated concurrently or sequentially. For details, see [How rules are evaluated within a group](ref:evaluation-within-a-group).

## Pending period

{{< shared id="pending-period-basics" >}}

You can set a **Pending period** to prevent unnecessary notifications caused by temporary issues.

When the alert condition is met, the alert instance enters the **Pending** state. It remains in this state until the condition has been continuously true for the entire **Pending period**.

This ensures the condition breach is stable before the alert transitions to the **Alerting** state and routed for notification.

{{< /shared >}}

- **Normal** -> **Pending** -> **Alerting**<sup>\*</sup>

You can also set the **Pending period** to zero to skip the **Pending** state entirely and transition to **Alerting** immediately.

## Keep firing for

{{< shared id="keep-firing-for" >}}

You can set a **Keep firing for** period to avoid repeated firing-resolving-firing notifications caused by flapping conditions.

When the alert condition is no longer met during the **Alerting** state, the alert instance enters the **Recovering** state.

{{< /shared >}}

- **Alerting** → **Recovering** → **Normal (Resolved)**<sup>\*</sup>
- After the **Keep firing for** period elapses, the alert transitions to the **Normal** state and is marked as **Resolved**.
- If the alert condition is met again, the alert transitions back to the **Alerting** state, and no new notifications are sent.

You can also set the **Keep firing for** period to zero to skip the **Recovering** state entirely.

## Evaluation example

Keep in mind:

- One alert rule can generate multiple alert instances—one for each series or dimension produced by the rule's query. Alert instances from the same alert rule may be in different states.
- Only alert instances in the **Alerting** and **Normal (Resolved)** state are routed for [notifications](ref:notifications).

Consider an alert rule with an **evaluation interval** set at every 30 seconds and a **pending period** of 90 seconds. The evaluation occurs as follows:

| Time                      | Condition | Alert instance state | Pending counter |
| ------------------------- | --------- | -------------------- | --------------- |
| 00:30 (first evaluation)  | Not met   | Normal               | -               |
| 01:00 (second evaluation) | Breached  | Pending              | 0s              |
| 01:30 (third evaluation)  | Breached  | Pending              | 30s             |
| 02:00 (fourth evaluation) | Breached  | Pending              | 60s             |
| 02:30 (fifth evaluation)  | Breached  | Alerting 📩          | 90s             |

With a **keep firing for** period of 0 seconds, the alert instance transitions immediately from **Alerting** to **Normal**, and marked as `Resolved`:

| Time                       | Condition | Alert instance state          | Pending counter |
| -------------------------- | --------- | ----------------------------- | --------------- |
| 03:00 (sixth evaluation)   | Not met   | Normal <sup>Resolved</sup> 📩 | 120s            |
| 03:30 (seventh evaluation) | Not met   | Normal                        | 150s            |
