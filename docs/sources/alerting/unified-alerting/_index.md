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

## Performance Considerations.

Grafana Alerting now supports multi-dimensional alerting, or templatized alerting, so that one alert rule can generate many separate alerts. For example, one alert rule could generate an alert for each VM that's CPU is maxed out. This new capability adds some new performance considerations.

Evaluating Alerting rules consumes RAM and CPU to compute the output of an alerting query, and network resources to write the results to the Grafana SQL database. The SQL database's network connections are often saturated before RAM or CPU are exhausted. The configuration of alert rules affects how many resources the Alertmanager consumes, and therefore the maximum number of rules a given configuration can support.

These load factors include:

1. The **frequency of rule evaluation**, controlled by the "Evaluate Every" field in the alert editor. Use the lowest acceptable evaluation frequency to support more concurrent rules.
2. The **cardinality of the rule's result set**. For example, you might be monitoring API response errors by monitoring errors for every API path, on every VM in your fleet. This has a cardinality of # paths x # VMs. Where possible, reduce the cardinality of a result set - perhaps by monitoring errors-per-VM instead for each path, for each VM.
3. The **complexity of the alerting query**. Queries that datasources are able to process and respond to quickly consume fewer resources. This is less important than the frequency of evaluation and the cardinality of the result set, but if you have reduced those as much as you can, looking at the performance of individual queries could make a difference.

Each evaluation of an alert rule generates a set of "alert instances", one for each member of the result set. The state of all alert instances are written to Grafana's SQL database in the `alert_instance` table.

To estimate the load that alerting queries are putting on your system, you can count the number of alert instances that have been updated recently. This is a rough estimate - if you have some rules evaluated every 30m, and others every 10s, load will be unevenly distributed.

The query will differ based on your database backend. For MySQL, over the last 5 minutes:

```sql
SELECT COUNT(*)
FROM 'alert_instance'
WHERE UNIX_TIMESTAMP() - 300 > 'last_eval_time';
```

These factors affect the load on the Grafana Alertmanager. You should also be aware of the load that evaluating these rules puts onto your datasources. Alerting queries are often the vast majority of queries handled by monitoring databases, so the same load factors that affect the Alertmanager affect them as well.
