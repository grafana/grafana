---
aliases:
  - ./alerting-limitations/ # /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/alerting-limitations/
  - ../../alerting/performance-limitations/ # /docs/grafana/<GRAFANA_VERSION>/alerting/performance-limitations/
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/performance-limitations/
description: Learn about performance considerations and limitations
keywords:
  - grafana
  - alerting
  - performance
  - limitations
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Performance considerations and limitations
weight: 800
---

# Performance considerations and limitations

Grafana Alerting supports multi-dimensional alerting, where one alert rule can generate many alerts. For example, you can configure an alert rule to fire an alert every time the CPU of individual virtual machines max out. This topic discusses performance considerations resulting from multi-dimensional alerting.

Evaluating alerting rules consumes RAM and CPU to compute the output of an alerting query, and network resources to send alert notifications and write the results to the Grafana SQL database. The configuration of individual alert rules affects the resource consumption and, therefore, the maximum number of rules a given configuration can support.

The following section provides a list of alerting performance considerations.

- Frequency of rule evaluation consideration. The "Evaluate Every" property of an alert rule controls the frequency of rule evaluation. It is recommended to use the lowest acceptable evaluation frequency to support more concurrent rules.
- Cardinality of the rule's result set. For example, suppose you are monitoring API response errors for every API path, on every virtual machine in your fleet. This set has a cardinality of _n_ number of paths multiplied by _v_ number of VMs. You can reduce the cardinality of a result set - perhaps by monitoring errors-per-VM instead of for each path per VM.
- Complexity of the alerting query consideration. Queries that data sources can process and respond to quickly consume fewer resources. Although this consideration is less important than the other considerations listed above, if you have reduced those as much as possible, looking at individual query performance could make a difference.

Each evaluation of an alert rule generates a set of alert instances; one for each member of the result set. The state of all the instances is written to the `alert_instance` table in the Grafana SQL database. This number of write-heavy operations can cause issues when using SQLite.

Grafana Alerting exposes a metric, `grafana_alerting_rule_evaluations_total` that counts the number of alert rule evaluations. To get a feel for the influence of rule evaluations on your Grafana instance, you can observe the rate of evaluations and compare it with resource consumption. In a Prometheus-compatible database, you can use the query `rate(grafana_alerting_rule_evaluations_total[5m])` to compute the rate over 5 minute windows of time. It's important to remember that this isn't the full picture of rule evaluation. For example, the load is unevenly distributed if you have some rules that evaluate every 10 seconds, and others every 30 minutes.

These factors all affect the load on the Grafana instance, but you should also be aware of the performance impact that evaluating these rules has on your data sources. Alerting queries are often the vast majority of queries handled by monitoring databases, so the same load factors that affect the Grafana instance affect them as well.

## Limited rule sources support

Grafana Alerting can retrieve alerting and recording rules **stored** in most available Prometheus, Loki, Mimir, and Alertmanager compatible data sources.

It does not support reading or writing alerting rules from any other data sources but the ones previously mentioned at this time.

## Prometheus version support

The latest two minor versions of both Prometheus and Alertmanager are supported. We cannot guarantee that older versions work.

As an example, if the current Prometheus version is `2.31.1`, >= `2.29.0` is supported.

## The Grafana Alertmanager can only receive Grafana managed alerts

Grafana cannot be used to receive external alerts. You can only send alerts to the Grafana Alertmanager using Grafana managed alerts.

You have the option to send Grafana-managed alerts to an external Alertmanager, you can find this option in the Admin tab on the Alerting page.

For more information, refer to [this GitHub issue](https://github.com/grafana/grafana/issues/73447).

## High load on database caused by a high number of alert instances

If you have a high number of alert rules or alert instances, the load on the database can get very high.

Grafana performs one SQL update per alert rule after each evaluation. This update groups all alert instances belonging to the rule together and compresses them into a single protobuf-based row, which keeps database overhead low even for alert rules with many instances.

{{< admonition type="warning" >}}
Earlier versions of Grafana wrote alert instance state to the database uncompressed, one row per instance, and let you opt in to compressed storage with the `alertingSaveStateCompressed` feature toggle. Grafana 13.2 removes that feature toggle and the uncompressed storage path entirely.

If you're upgrading from a Grafana version where you had explicitly disabled `alertingSaveStateCompressed`, enable it and let Grafana run for at least one evaluation cycle _before_ you upgrade to Grafana 13.2 or later. Otherwise, any alert state still held in the old uncompressed format isn't read after the upgrade. This doesn't cause data loss beyond the alert state itself: Grafana re-evaluates every rule and rebuilds instance state from scratch, but you might see a brief, one-time gap in alert history and current state immediately after the upgrade.
{{< /admonition >}}

### Save state periodically

You can also reduce database load by writing states periodically instead of after every evaluation.

Enable the `alertingSaveStatePeriodic` feature toggle to save alert states at the interval specified by `state_periodic_save_interval` instead of after every rule evaluation. Grafana groups all alert instances by rule UID and compresses them together for efficient storage.

By default, Grafana saves the states every 5 minutes and on each shutdown. Note that `state_periodic_save_batch_size` and `state_periodic_save_jitter_enabled` don't apply here, since Grafana groups instances by rule UID rather than by batch.

```ini
[unified_alerting]
state_periodic_save_interval = 1m
```

If Grafana crashes or is force killed, then the database can be up to `state_periodic_save_interval` seconds out of date.
When Grafana restarts, the UI might show incorrect state for some alerts until the alerts are re-evaluated.
In some cases, alerts that were firing before the crash might fire again.
If this happens, Grafana might send duplicate notifications for firing alerts.

## Limit on the number of results per alert rule

Each alert rule evaluation generates one alert instance per series in the rule's query result set. Rules with high-cardinality result sets consume more CPU, memory, network, and database resources, and can produce a large number of alert instances (refer to [High load on database caused by a high number of alert instances](#high-load-on-database-caused-by-a-high-number-of-alert-instances)).

To prevent this, Grafana can limit the number of query evaluation results a single alert rule produces in one evaluation. When a rule's query returns more results than the limit, the evaluation fails with an error similar to the following:

```
query evaluation returned too many results: 12345 (limit: 10000)
```

The alert rule enters the [Error state](/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/nodata-and-error-states/) and produces no alert instances for that evaluation until you reduce its result set below the limit.

In self-managed Grafana, set this limit using the [`alerting_rule_evaluation_results`](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana#alerting_rule_evaluation_results) option in the `[quota]` section. The default is `-1` (unlimited). In Grafana Cloud, Grafana Labs manages this limit.

To resolve the error, reduce the cardinality of the rule's result set:

- Aggregate the query so it returns fewer series. For example, sum or average by fewer labels.
- Add label filters so the query returns only the series you need to alert on.
- Split a single high-cardinality rule into several rules with narrower queries.

## Alert rule migrations for Grafana 11.6.0

When you upgrade to Grafana 11.6.0, a migration is performed on the `alert_rule_versions` table. If you experience a 11.6.0 upgrade that causes a migration failure, then your `alert_rule_versions` table has too many rows. To fix this, you need to truncated the `alert_rule_versions` table for the migration to complete.
