---
title: Alert rule evaluation
description: Introduction to alert rule evaluation
weight: 106
keywords:
  - grafana
  - alerting
  - evaluation
---

# Alert rule evaluation

Use alert rule evaluation to determine how frequently an alert rule should be evaluated and how quickly it should change its state.

To do this, you need to make sure that your alert rule is in the right evaluation group and set a pending period time that works best for your use case.

## Evaluation group

Every alert rule is part of an evaluation group. Each evaluation group contains an evaluation interval that determines how frequently the alert rule is checked. Alert rules within the same group are evaluated one after the other, while alert rules in different groups can be evaluated simultaneously.

This feature is especially useful for Prometheus/Mimir rules when you want to ensure that recording rules are evaluated before any alert rules.

**Note:**

Evaluation groups and alerts grouping in notification policies are two separate things. Grouping in notification policies allows multiple alerts sharing the same labels to be sent in the same time message.

## Pending period

By setting a pending period, you can avoid unnecessary alerts for temporary problems.

In the pending period, you select the period in which an alert rule can be in breach of the condition until it fires.

**Example**

Imagine you have an alert rule evaluation interval set at every 30 seconds and the pending period to 90 seconds.

Evaluation will occur as follows:

[00:30] First evaluation - condition not met.

[01:00] Second evaluation - condition breached.
Pending counter starts. **Alert stars pending.**

[01:30] Third evaluation - condition breached. Pending counter = 30s. **Pending state.**

[02:00] Fourth evaluation - condition breached. Pending counter = 60s **Pending state.**

[02:30] Fifth evaluation - condition breached. Pending counter = 90s. **Alert starts firing**

If the alert rule has a condition that needs to be in breach for a certain amount of time before it takes action, then its state changes as follows:

- When the condition is first breached, the rule goes into a "pending" state.

- The rule stays in the "pending" state until the condition has been broken for the required amount of time - pending period.

- Once the required time has passed, the rule goes into a "firing" state.

- If the condition is no longer broken during the pending period, the rule goes back to its normal state.

**Note:**

If you want to skip the pending state, you can simply set the pending period to 0. This effectively skips the pending period and your alert rule will start firing as soon as the condition is breached.

When an alert rule fires, alert instances are produced, which are then sent to the Alertmanager.
