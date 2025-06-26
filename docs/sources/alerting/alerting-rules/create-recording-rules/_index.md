---
aliases:
  - ../fundamentals/alert-rules/recording-rules/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/recording-rules/
  - ../unified-alerting/alerting-rules/create-cortex-loki-managed-recording-rule/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/create-cortex-loki-managed-recording-rule/
  - ../unified-alerting/alerting-rules/create-mimir-loki-managed-recording-rule/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/create-mimir-loki-managed-recording-rule/
  - ../alerting-rules/create-mimir-loki-managed-recording-rule/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-mimir-loki-managed-recording-rule/
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-recording-rules/
description: Recording rules allow you to pre-compute frequently needed or computationally expensive expressions and save the results as a new set of time series. Querying precomputed results is faster and can reduce system load.
keywords:
  - grafana
  - alerting
  - guide
  - rules
  - recording rules
  - configure
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Create recording rules
weight: 400
refs:
  grafana-managed-recording-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/
  data-source-managed-recording-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/create-data-source-managed-recording-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-recording-rules/create-data-source-managed-recording-rules/
---

# Configure recording rules

Recording rules allows you to periodically pre-compute frequently used or computationally expensive queries, saving the results as a new time series metric.

For instance, you can create a recording rule generating a new metric, `error_9001_count`, which counts occurrences of a specific log error within one minute. Then, query the `error_9001_count` metric in dashboards and alert rules.

Recording rules can be helpful in various scenarios, such as:

- **Faster queries** are needed: Performing heavy aggregations or querying large data sets is quicker with precomputed results than real-time queries.
- **Reducing system load:** Precomputing specific queries in advance can reduce system overload caused by multiple simultaneous queries.
- **Simplifying complex aggregations:** Create a new metric from complex aggregations to facilitate alert and dashboard setup.
- **Reusing queries across alerts:** Improve efficiency by reusing the same query across similar alert rules and dashboards.

The evaluation group of the recording rule determines how often the metric is pre-computed.

Similar to alert rules, Grafana supports two types of recording rules:

1. [Grafana-managed recording rules](ref:grafana-managed-recording-rules), which can query any Grafana data source supported by alerting. It's the recommended option.
2. [Data source-managed recording rules](ref:data-source-managed-recording-rules), which can query Prometheus-based data sources like Mimir or Loki.
