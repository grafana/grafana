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
  alerts-state-health:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/state-and-health/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/state-and-health/
  import-ds-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/alerting-migration/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/alerting-migration/
---

# Alert rule evaluation

The criteria determining when an alert rule fires are based on two settings:

- [Evaluation group](#evaluation-group): how frequently the alert rule is evaluated.
- [Pending period](#pending-period): how long the condition must be met to start firing.

{{< figure src="/media/docs/alerting/alert-rule-evaluation-2.png" max-width="750px" alt="Set the evaluation behavior of the alert rule in Grafana." caption="Set alert rule evaluation" >}}

## Evaluation group

Every alert rule and recording rule is assigned to an evaluation group. You can assign the rule to an existing evaluation group or create a new one.

Each evaluation group contains an **evaluation interval** that determines how frequently the rule is checked. For instance, the evaluation may occur every `10s`, `30s`, `1m`, `10m`, etc.

**Evaluation strategies**

Rules in different groups can be evaluated simultaneously.

- **Grafana-managed** rules within the same group are evaluated concurrently—they are evaluated at different times over the same evaluation interval but display the same evaluation timestamp.

- **Data source-managed** rules within the same group are evaluated sequentially, one after the other—this is useful to ensure that recording rules are evaluated before alert rules.

- **Grafana-managed rules [imported from data source-managed rules](ref:import-ds-rules)** are evaluated sequentially, like data source-managed rules.

## Pending period

You can set a pending period to prevent unnecessary alerts from temporary issues.

The pending period specifies how long the condition must be met before firing, ensuring the condition is consistently met over a consecutive period.

You can also set the pending period to zero to skip it and have the alert fire immediately once the condition is met.

## Keep firing for

You can set a period to keep an alert firing after the threshold is no longer breached. This sets the alert to a Recovering state. In a Recovering state, the alert won’t fire again if the threshold is breached. The Keep firing timer is then reset and the alert transitions back to Alerting state.

The Keep firing for period helps reduce repeated firing-resolving-firing notification scenarios caused by flapping alerts.

## Evaluation example

Keep in mind:

- One alert rule can generate multiple alert instances - one for each time series produced by the alert rule's query.
- Alert instances from the same alert rule may be in different states. For instance, only one observed machine might start firing.
- Only **Alerting** and **Resolved** alert instances are routed to manage their notifications.

{{< figure src="/media/docs/alerting/alert-rule-evaluation-overview-statediagram-v2.png" alt="A diagram of the alert instance states and when to route their notifications."  max-width="750px" >}}

<!--
Remove ///
stateDiagram-v2
    direction LR
        Normal --///> Pending
        note right of Normal
            Route "Resolved" alert instances
            for notifications
        end note
        Pending --///> Alerting
        Alerting --///> Normal: Resolved
        note right of Alerting
            Route "Alerting" alert instances
            for notifications
        end note
-->

Consider an alert rule with an **evaluation interval** set at every 30 seconds and a **pending period** of 90 seconds. The evaluation occurs as follows:

| Time                      | Condition | Alert instance state  | Pending counter |
| ------------------------- | --------- | --------------------- | --------------- |
| 00:30 (first evaluation)  | Not met   | Normal                | -               |
| 01:00 (second evaluation) | Breached  | Pending               | 0s              |
| 01:30 (third evaluation)  | Breached  | Pending               | 30s             |
| 02:00 (fourth evaluation) | Breached  | Pending               | 60s             |
| 02:30 (fifth evaluation)  | Breached  | Alerting<sup>\*</sup> | 90s             |

An alert instance is resolved when it transitions from the `Firing` to the `Normal` state. For instance, in the previous example:

| Time                       | Condition | Alert instance state          | Pending counter |
| -------------------------- | --------- | ----------------------------- | --------------- |
| 03:00 (sixth evaluation)   | Not met   | Normal <sup>Resolved \*</sup> | 120s            |
| 03:30 (seventh evaluation) | Not met   | Normal                        | 150s            |

To learn more about the state changes of alert rules and alert instances, refer to [State and health of alert rules](ref:alerts-state-health).
