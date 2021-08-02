+++
title = "State and Health of alerting rules"
description = "State and Health of alerting rules"
keywords = ["grafana", "alerting", "guide", "state"]
+++

# State and Health of alerting rule

The concepts of state and health for alerting rules help you understand, at a glance, several key status indicators about your alerts. Alert state, alerting rule state, and alerting rule health are related, but they each convey subtly different information.

## Alerting rule state
Indicates whether any of the timeseries resulting from evaluation of the alerting rule are in an alerting state. Alerting rule state only requires a single alerting instance to be in a pending or firing state for the alerting rule state to not be normal.
- Normal: none of the timeseries returned are in an alerting state.
- Pending: at least one of the timeseries returned are in a pending state.
- Firing: at least one of the timeseries returned are in an alerting state.

## Alert state
Alert state is an indication of the output of the alerting evaluation engine.
- Normal: the condition for the alerting rule has evaluated to **false** for every timeseries returned by the evaluation engine.
- Alerting: the condition for the alerting rule has evaluated to **true** for at least one timeseries returned by the evaluation engine and the duration, if set, **has** been met or exceeded.
- Pending: the condition for the alerting rule has evaluated to **true** for at least one timeseries returned by the evaluation engine and the duration, if set, **has not** been met or exceeded.
- NoData: the alerting rule has not returned a timeseries, all values for the timeseries are null, or all values for the timeseries are zero.
- Error: There was an error encountered when attempting to evaluate the alerting rule.

## Alerting rule health
Indicates the status of alerting rule evaluation.
- Ok: the rule is being evaluated, data is being returned, and no errors have been encountered.
- Error: an error was encountered when evaluating the alerting rule.
- NoData: at least one of the timeseries returned during evaluation is in a NoData state.
