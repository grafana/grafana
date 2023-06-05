---
description: About Grafana alert rules
keywords:
  - grafana
  - alerting
  - rules
title: Alert rules
weight: 101
---

# About alert rules

An alerting rule is a set of evaluation criteria that determines whether an alert instance will fire. The rule consists of one or more queries and expressions, a condition, the frequency of evaluation, and optionally, the duration over which the condition is met.

While queries and expressions select the data set to evaluate, a condition sets the threshold that an alert must meet or exceed to create an alert.

An interval specifies how frequently an alerting rule is evaluated. Duration, when configured, indicates how long a condition must be met. The alert rules can also define alerting behavior in the absence of data.

- [Alert rule types]({{< relref "alert-rule-types/" >}})
- [Alert instances]({{< relref "alert-instances/" >}})
- [Organising alert rules]({{< relref "organising-alerts/" >}})
- [Annotation and labels]({{< relref "../annotation-label/" >}})
