+++
title = "Grafana alerts"
aliases = ["/docs/grafana/latest/alerting/metrics/"]
weight = 113
+++

# Overview of Grafana alerting

Grafana 8.0 has new and improved alerting that centralizes alerting information in a single, searchable view. It is enabled by default for all new OSS instances, and is an [opt-in]({{< relref "./opt-in.md" >}}) feature for older installations that still use legacy dashboard alerting. We encourage you to create issues in the Grafana GitHub repository for bugs found while testing Grafana alerting. See also, [What's New with Grafana alerting]({{< relref "./difference-old-new.md" >}}).

When Grafana alerting is enabled, you can:

- [Create Grafana managed alerting rules]({{< relref "alerting-rules/create-grafana-managed-rule.md" >}})
- [Create Grafana Mimir or Loki managed alerting rules]({{< relref "alerting-rules/create-mimir-loki-managed-rule.md" >}})
- [View existing alerting rules and manage their current state]({{< relref "alerting-rules/rule-list.md" >}})
- [View the state and health of alerting rules]({{< relref "./fundamentals/state-and-health.md" >}})
- [Add or edit an alert contact point]({{< relref "./contact-points.md" >}})
- [Add or edit notification policies]({{< relref "./notifications/_index.md" >}})
- [Add or edit silences]({{< relref "./silences.md" >}})

Before you begin using Grafana alerting, we recommend that you familiarize yourself with some [basic concepts]({{< relref "./fundamentals/_index.md" >}}) of Grafana alerting.

## Limitations

- The Grafana alerting system can retrieve rules from all available Prometheus, Loki, and Alertmanager data sources. It might not be able to fetch rules from other supported data sources.
- We aim to support the latest two minor versions of both Prometheus and Alertmanager. We cannot guarantee that older versions will work. As an example, if the current Prometheus version is `2.31.1`, we support >= `2.29.0`.

## Performance considerations.

Grafana alerting supports multi-dimensional alerting, where one alert rule can generate many alerts. For example, you can configure an alert rule to fire an alert every time the CPU of individual VMs max out. This topic discusses performance considerations resulting from multi-dimensional alerting.

Evaluating alerting rules consumes RAM and CPU to compute the output of an alerting query, and network resources to send alert notifications and write the results to the Grafana SQL database. The configuration of individual alert rules affects the resource consumption and, therefore, the maximum number of rules a given configuration can support.

Considerations include:

- The frequency of rule evaluation consideration. The "Evaluate Every" propery of an alert rule controls the frequency of rule evalution. We recommend using the lowest acceptable evaluation frequency to support more concurrent rules.
- The cardinality of the rule's result set. For example, suppouse you are monitoring API response errors for every API path, on every VM in your fleet. This set has a cardinality of _n_ number of paths multipled by _v_ number of VMs. You can reduce the cardinality of a result set - perhaps by monitoring errors-per-VM instead of for each path per VM.
- The complexity of the alerting query consideration. Queries that data sources can process and respond to quickly consume fewer resources. Although this consideration is less important than the other considerations listed above, if you have reduced those as much as possible, looking at individual query performance could make a difference.

Each evaluation of an alert rule generates a set of alert instances, one for each member of the result set. The state of all the instances is written to the `alert_instance` table in Grafana's SQL database.

Grafana alerting exposes a metric, `grafana_alerting_rule_evaluations_total`, that counts the number of alert rule evaluations. To get a feel for the influence of rule evaluations on your Grafana instance, you can observe the rate of evaluations and compare it with resource consumption. In a Prometheus-compatible database, you can use the query `rate(grafana_alerting_rule_evaluations_total[5m])` to compute the rate over 5 minute windows of time. It's important to remember that this isn't the full picture of rule evaluation. For example, the load will be unevenly distributed if you have some rules that evaluate every 10 seconds, and others every 30 minutes.

These factors all affect the load on the Grafana instance, but you should also be aware of the performance impact that evaluating these rules has on your data sources. Alerting queries are often the vast majority of queries handled by monitoring databases, so the same load factors that affect the Grafana instance affect them as well.
