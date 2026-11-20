---
aliases:
  - rules/ # /docs/grafana/<GRAFANA_VERSION>/alerting/rules/
  - unified-alerting/alerting-rules/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/
  - ./create-alerts/ # /docs/grafana/<GRAFANA_VERSION>/alerting/create-alerts/
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/
description: Configure alert rules
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Configure alert rules
weight: 120
---

# Configure alert rules

[Alert rules](/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/) are the central component of your alerting system.

An alert rule consists of one or more queries and expressions that select the data you want to measure. It contains a condition to trigger the alert, an evaluation period that determines how often the rule is evaluated, and additional options to manage alert events and their notifications.

Alert rules in Grafana Alerting are Grafana-managed: Grafana stores and evaluates them. They can query any backend data source that supports alerting, including Prometheus-based ones, and combine multiple data sources in a single rule.

To create alert rules with the **+ New alert rule** flow, refer to [Configure Grafana-managed alert rules](/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/).

In Grafana Alerting, you can also [configure recording rules](/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/), which pre-compute queries and save the results as new time series metrics for use in other alert rules or dashboard queries.

When your alert rules depend on recording rule results, use [Configure rule sequences](/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/rule-sequences/) to define their evaluation order and shared interval through the API or Terraform.

## Alert rules stored in a data source

If you have alert rules stored in a Prometheus-compatible data source, such as Mimir, Loki, or Prometheus, you can [import them into Grafana-managed rules](/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/alerting-migration/) to let Grafana Alerting manage them.

To keep managing alert rules in the data source, refer to [Legacy data source-managed alerts](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/).
