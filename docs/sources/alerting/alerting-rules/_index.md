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
refs:
  alert-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/
  configure-grafana-alerts:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-grafana-managed-rule/
  configure-ds-alerts:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-data-source-managed-rule/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-data-source-managed-rule/
  recording-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-recording-rules/
  import-to-grafana-managed:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/alerting-migration/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/alerting-migration/
  comparison-ds-grafana-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-data-source-managed-rule/#comparison-with-grafana-managed-rules
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-data-source-managed-rule/#comparison-with-grafana-managed-rules
---

# Configure alert rules

[Alert rules](ref:alert-rules) are the central component of your alerting system.

An alert rule consists of one or more queries and expressions that select the data you want to measure. It contains a condition to trigger the alert, an evaluation period that determines how often the rule is evaluated, and additional options to manage alert events and their notifications.

Grafana supports two types of alert rules:

1. **Grafana-managed alert rules** — the recommended option. They can query backend data sources—including Prometheus-based ones—and offer a [richer feature set](ref:comparison-ds-grafana-rules).
1. **Data source-managed alert rules** — supported for Prometheus-based data sources (such as Mimir, Loki, and Prometheus), with rules stored in the data source itself.

   You can [convert and import data source-managed rules into Grafana-managed rules](ref:import-to-grafana-managed) to let Grafana Alerting manage them.

Both types of alert rules can be configured in Grafana using the **+ New alert rule** flow. For step-by-step instructions, refer to:

- [Configure Grafana-managed alert rules](ref:configure-grafana-alerts)
- [Configure data source-managed alert rules](ref:configure-ds-alerts)

In Grafana Alerting, you can also [configure recording rules](ref:recording-rules), which pre-compute queries and save the results as new time series metrics for use in other alert rules or dashboard queries.
