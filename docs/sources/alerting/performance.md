---
aliases: []
description: Understanding alerting performance
keywords:
  - grafana
  - alerting
  - performance
title: Performance considerations
weight: 555
---

# Alerting performance considerations

Grafana Alerting supports multi-dimensional alerting, where one alert rule can generate many alerts. For example, you can configure an alert rule to fire an alert every time the CPU of individual VMs max out. This topic discusses performance considerations resulting from multi-dimensional alerting.

Evaluating alerting rules consumes RAM and CPU to compute the output of an alerting query, and network resources to send alert notifications and write the results to the Grafana SQL database. The configuration of individual alert rules affects the resource consumption and, therefore, the maximum number of rules a given configuration can support.

The following section provides a list of alerting performance considerations.

- Frequency of rule evaluation consideration. The "Evaluate Every" property of an alert rule controls the frequency of rule evaluation. We recommend using the lowest acceptable evaluation frequency to support more concurrent rules.
- Cardinality of the rule's result set. For example, suppose you are monitoring API response errors for every API path, on every VM in your fleet. This set has a cardinality of _n_ number of paths multiplied by _v_ number of VMs. You can reduce the cardinality of a result set - perhaps by monitoring errors-per-VM instead of for each path per VM.
- Complexity of the alerting query consideration. Queries that data sources can process and respond to quickly consume fewer resources. Although this consideration is less important than the other considerations listed above, if you have reduced those as much as possible, looking at individual query performance could make a difference.

Each evaluation of an alert rule generates a set of alert instances; one for each member of the result set. The state of all the instances is written to the `alert_instance` table in Grafana's SQL database.

Grafana Alerting exposes a metric, `grafana_alerting_rule_evaluations_total` that counts the number of alert rule evaluations. To get a feel for the influence of rule evaluations on your Grafana instance, you can observe the rate of evaluations and compare it with resource consumption. In a Prometheus-compatible database, you can use the query `rate(grafana_alerting_rule_evaluations_total[5m])` to compute the rate over 5 minute windows of time. It's important to remember that this isn't the full picture of rule evaluation. For example, the load will be unevenly distributed if you have some rules that evaluate every 10 seconds, and others every 30 minutes.

These factors all affect the load on the Grafana instance, but you should also be aware of the performance impact that evaluating these rules has on your data sources. Alerting queries are often the vast majority of queries handled by monitoring databases, so the same load factors that affect the Grafana instance affect them as well.
