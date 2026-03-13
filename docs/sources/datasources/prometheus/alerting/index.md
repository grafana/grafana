---
aliases:
  - ../../data-sources/prometheus/alerting/
description: Using Grafana Alerting with the Prometheus data source
keywords:
  - grafana
  - prometheus
  - alerting
  - alerts
  - rules
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Alerting
title: Prometheus alerting
weight: 550
review_date: 2026-03-10
---

# Prometheus alerting

You can use Grafana Alerting with the Prometheus data source to create alert rules based on PromQL queries. This allows you to monitor metrics, detect anomalies, and receive notifications when specific conditions are met.

For general information about Grafana Alerting, refer to [Grafana Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/).

## Before you begin

Before you create alerts with Prometheus, ensure you have:

- A [configured Prometheus data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/configure/)
- Appropriate permissions to create alert rules
- Familiarity with [PromQL](https://prometheus.io/docs/prometheus/latest/querying/basics/) query syntax

## Prometheus vs. Mimir alerting capabilities

The Prometheus data source supports two alerting modes depending on the backend you connect to.

| Capability                                 | Prometheus | Grafana Mimir / Cortex |
| ------------------------------------------ | ---------- | ---------------------- |
| View existing alert rules                  | Yes        | Yes                    |
| Create and manage alert rules from Grafana | No         | Yes                    |
| View existing alerts                       | Yes        | Yes                    |
| Use as recording rules target              | Yes        | Yes                    |

When connected to a standard Prometheus server, Grafana can display alert rules and alerts that are defined in your Prometheus configuration, but you can't create or modify them through the Grafana UI. To manage alert rules directly from Grafana, use [Grafana Mimir](https://grafana.com/docs/mimir/latest/) or a compatible ruler API.

Regardless of the backend, you can always create **Grafana-managed alert rules** that use PromQL queries to evaluate conditions.

## Create a Grafana-managed alert rule

Grafana-managed alert rules evaluate PromQL queries on a schedule and trigger notifications based on conditions you define.

To create an alert rule using Prometheus:

1. Navigate to **Alerting** > **Alert rules**.
1. Click **New alert rule**.
1. Enter a name for the alert rule.
1. Select your **Prometheus** data source.
1. Write a PromQL query in the query editor. For example, `rate(http_requests_total{status="500"}[5m]) > 0.1`.
1. Configure the alert condition (for example, when the last value is above a threshold).
1. Set the evaluation interval and pending period.
1. Configure notification labels, contact points, and any additional settings.
1. Click **Save rule**.

For detailed instructions, refer to [Create a Grafana-managed alert rule](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/).

## Configure alerting settings

The Prometheus data source configuration includes two alerting-related settings. To change these, navigate to your Prometheus data source settings page.

| Setting                             | Description                                                                                                                                                        | Default |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| **Manage alerts via Alerting UI**   | Enables data source-managed rules for this data source. For Prometheus, this allows viewing existing rules and alerts. For Mimir, it enables full rule management. | On      |
| **Allow as recording rules target** | Allows this data source to be selected as a target for Grafana-managed recording rules.                                                                            | On      |

For more configuration details, refer to [Configure the Prometheus data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/configure/).

## Example alert queries

The following examples show common alerting scenarios with Prometheus.

### Alert on high error rate

Monitor the rate of HTTP 500 errors:

- **Query:** `rate(http_requests_total{status="500"}[5m])`
- **Condition:** When the last value is above `0.05`

### Alert on high memory usage

Monitor memory usage as a percentage of total available memory:

- **Query:** `(1 - (node_memory_AvailableBytes / node_memory_MemTotal)) * 100`
- **Condition:** When the last value is above `90`

### Alert on target down

Monitor whether Prometheus targets are reachable:

- **Query:** `up == 0`
- **Condition:** When the last value is `0`

## Limitations

When using Prometheus with Grafana Alerting, be aware of the following limitations.

### Template variables aren't supported

Alert queries can't contain template variables. Grafana evaluates alert rules on the backend without dashboard context, so variables like `$instance` or `$job` aren't resolved.

If your dashboard query uses template variables, create a separate query for alerting with hard-coded values.

### Exemplars are disabled for alert queries

Grafana automatically disables exemplar queries when evaluating alert rules, because exemplars aren't relevant for alerting evaluation.

### Rule management requires Mimir or Cortex

Standard Prometheus doesn't expose a ruler API for managing alert rules remotely. To create and manage data source-managed alert rules directly from Grafana, connect to Grafana Mimir or a Cortex-compatible backend.

## Best practices

Follow these best practices when creating Prometheus alerts:

- **Test queries in Explore first:** Verify your PromQL query returns expected results in [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) before creating an alert rule.
- **Use appropriate evaluation intervals:** Match the evaluation interval to the urgency of the alert. Critical alerts may need short intervals (for example, `1m`), while capacity alerts can use longer intervals (for example, `5m`).
- **Use `rate()` and `increase()` over `irate()`:** The `rate()` and `increase()` functions are more reliable for alerting because they smooth out brief spikes.
- **Set realistic pending periods:** Use a pending period to avoid alerting on transient spikes. For example, set a 5-minute pending period so the condition must persist before the alert fires.
- **Use labels for routing:** Add labels to your alert rules to route notifications to the appropriate contact points.
