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

By default, Grafana performs one SQL update per alert rule after each evaluation, which updates all alert instances belonging to the rule.

You can change this behavior by disabling the `alertingSaveStateCompressed` feature flag. In this case, Grafana performs a separate SQL update for each state change of an alert instance. This configuration is rarely recommended, as it can add significant database overhead for alert rules with many instances.

### Save state periodically

You can also reduce database load by writing states periodically instead of after every evaluation.

There are two approaches for periodic state saving:

#### Compressed periodic saves

You can combine compressed alert state storage with periodic saves by enabling both `alertingSaveStateCompressed` and `alertingSaveStatePeriodic` feature toggles together.

This approach groups all alert instances by rule UID and compresses them together for efficient storage.

When both feature toggles are enabled, Grafana will save compressed alert states at the interval specified by `state_periodic_save_interval`. Note that in compressed mode, the `state_periodic_save_batch_size` setting is ignored as the system groups instances by rule UID rather than by batch size.

#### Batch-based periodic saves

Alternatively, you can use batch-based periodic saves without compression:

This approach processes individual alert instances in batches of a specified size.

1. Enable the `alertingSaveStatePeriodic` feature toggle.
1. Disable the `alertingSaveStateCompressed` feature toggle.

By default, it saves the states every 5 minutes to the database and on each shutdown. The periodic interval
can also be configured using the `state_periodic_save_interval` configuration flag. During this process, Grafana deletes all existing alert instances from the database and then writes the entire current set of instances back in batches in a single transaction.
Configure the size of each batch using the `state_periodic_save_batch_size` configuration option.

##### Jitter for batch-based periodic saves

To further distribute database load, you can enable jitter for periodic state saves by setting `state_periodic_save_jitter_enabled = true`. When jitter is enabled, instead of saving all batches simultaneously, Grafana spreads the batch writes across a calculated time window of 85% of the save interval.

**How jitter works:**

- Calculates delays for each batch: `delay = (batchIndex * timeWindow) / (totalBatches - 1)`
- Time window uses 85% of save interval for safety margin
- Batches are evenly distributed across the time window
- All operations occur within a single database transaction

**Configuration example:**

```ini
[unified_alerting]
state_periodic_save_jitter_enabled = true
state_periodic_save_interval = 1m
state_periodic_save_batch_size = 100
```

**Performance impact:**
For 2000 alert instances with 1-minute interval and 100 batch size:

- Creates 20 batches (2000 ÷ 100)
- Spreads writes across 51 seconds (85% of 60s)
- Batch writes occur every ~2.68 seconds

This helps reduce database load spikes in environments with high alert cardinality by distributing writes over time rather than concentrating them at the beginning of each save cycle.


The time it takes to write to the database periodically can be monitored using the `state_full_sync_duration_seconds` metric
that is exposed by Grafana.

If Grafana crashes or is force killed, then the database can be up to `state_periodic_save_interval` seconds out of date.
When Grafana restarts, the UI might show incorrect state for some alerts until the alerts are re-evaluated.
In some cases, alerts that were firing before the crash might fire again.
If this happens, Grafana might send duplicate notifications for firing alerts.

## Alert rule migrations for Grafana 11.6.0

When you upgrade to Grafana 11.6.0, a migration is performed on the `alert_rule_versions` table. If you experience a 11.6.0 upgrade that causes a migration failure, then your `alert_rule_versions` table has too many rows. To fix this, you need to truncated the `alert_rule_versions` table for the migration to complete.
