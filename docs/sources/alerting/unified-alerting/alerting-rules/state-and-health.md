+++
title = "State and Health of alerting rules"
description = "State and Health of alerting rules"
keywords = ["grafana", "alerting", "guide", "state"]
+++

# State and Health of alerting rule

The state and health of alerting rules help you understand, at a glance, several key status indicators about your alerts. There are three key components - alert state, alerting rule state, and alerting rule health. Although related, each component convey subtly different information.

## Alerting rule state

Indicates whether any of the timeseries resulting from rule evaluation is in an alerting state. Alerting rule state only requires a single alerting instance to be in a pending or firing state for the alerting rule state to not be normal.

- Normal: Timeseries returned  by the evaluation engin is not in a pending or firing state.
- Pending: At least one timeseries returned  by the evaluation engin is in an pending state.
- Firing: At least one timeseries returned  by the evaluation engin is in an alerting state.

## Alert state

Alert state evaluates the output of the alerting evaluation engine.

- **Normal**: Condition for the alerting rule is **false** for every timeseries returned by the evaluation engine.
- **Alerting**: Condition of the alerting rule is **true** for at least one timeseries returned by the evaluation engine. The duration for which the condition must be true before an alert fires, if set, is met or has exceeded.
- **Pending**: Condition of the alerting rule is **true** for at least one timeseries returned by the evaluation engine. The duration for which the condition must be true before an alert fires, if set, **has not** been met.
- **NoData**: the alerting rule has not returned a timeseries, all values for the timeseries are null, or all values for the timeseries are zero.
- **Error**: Error when attempting to evaluate an alerting rule.

## Alerting rule health

Indicates the status of alerting rule evaluation.

- **Ok**: No error when evaluating an alerting rule.
- **Error**: Error when evaluating an alerting rule.
- **NoData**: The absence of data in at least one timeseries returned during a rule evaluation.
