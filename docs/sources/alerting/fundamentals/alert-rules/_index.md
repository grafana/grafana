---
description: About Grafana alert rules
keywords:
  - grafana
  - alerting
  - rules
title: Alert rules
weight: 101
---

# Alert rules

An alert rule is a set of evaluation criteria for when an alert rule should fire. An alert rule consists of one or more queries and expressions, a condition, and the duration over which the condition needs to be met to start firing.

While queries and expressions select the data set to evaluate, a condition sets the threshold that an alert must meet or exceed to create an alert.

An interval specifies how frequently an alerting rule is evaluated. Duration, when configured, indicates how long a condition must be met. The alert rules can also define alerting behavior in the absence of data.

- [Alert rule types]({{< relref "alert-rule-types/" >}})
- [Alert instances]({{< relref "alert-instances/" >}})
- [Organising alert rules]({{< relref "organising-alerts/" >}})
- [Annotation and labels]({{< relref "../annotation-label/" >}})
