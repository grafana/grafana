---
aliases:
  - /docs/grafana/llatest/alerting/unified-alerting/alerting-rules/state-and-health/
description: State and Health of alerting rules
keywords:
  - grafana
  - alerting
  - guide
  - state
title: State and health of alerting rules
---

# State and health of alerting rules

The state and health of alerting rules help you understand several key status indicators about your alerts. There are three key components: alert state, alerting rule state, and alerting rule health. Although related, each component conveys subtly different information.

## Alerting rule state

- **Normal**: None of the time series returned by the evaluation engine is in a Pending or Firing state.
- **Pending**: At least one time series returned by the evaluation engine is Pending.
- **Firing**: At least one time series returned by the evaluation engine is Firing.

## Alert state

- **Normal**: Condition for the alerting rule is **false** for every time series returned by the evaluation engine.
- **Alerting**: Condition of the alerting rule is **true** for at least one time series returned by the evaluation engine. The duration for which the condition must be true before an alert fires, if set, is met or has exceeded.
- **Pending**: Condition of the alerting rule is **true** for at least one time series returned by the evaluation engine. The duration for which the condition must be true before an alert fires, if set, **has not** been met.
- **NoData**: the alerting rule has not returned a time series, all values for the time series are null, or all values for the time series are zero.
- **Error**: Error when attempting to evaluate an alerting rule.

## Alerting rule health

- **Ok**: No error when evaluating an alerting rule.
- **Error**: Error when evaluating an alerting rule.
- **NoData**: The absence of data in at least one time series returned during a rule evaluation.
