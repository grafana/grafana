---
aliases:
  - ../rules/
title: Create and manage rules
weight: 130
---

# Create and manage Grafana alerting rules

An alerting rule is a set of evaluation criteria that determines whether an alert will fire. The rule consists of one or more queries and expressions, a condition, the frequency of evaluation, and optionally, the duration over which the condition is met.

While queries and expressions select the data set to evaluate, a condition sets the threshold that an alert must meet or exceed to create an alert. An interval specifies how frequently an alerting rule is evaluated. Duration, when configured, indicates how long a condition must be met. The rules can also define alerting behavior in the absence of data.

You can:

- [Create Grafana Mimir or Loki managed alert rule]({{< relref "./create-mimir-loki-managed-rule.md" >}})
- [Create Grafana Mimir or Loki managed recording rule]({{< relref "./create-mimir-loki-managed-recording-rule.md" >}})
- [Edit Grafana Mimir or Loki rule groups and namespaces]({{< relref "./edit-mimir-loki-namespace-group.md" >}})
- [Create Grafana managed alert rule]({{< relref "./create-grafana-managed-rule.md" >}})
- [State and health of alerting rules]({{< relref "../fundamentals/state-and-health.md" >}})
- [Manage alerting rules]({{< relref "./rule-list.md" >}})
