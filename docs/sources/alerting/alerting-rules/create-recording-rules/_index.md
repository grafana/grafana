---
aliases:
  - ../fundamentals/alert-rules/recording-rules/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/recording-rules/
  - ../unified-alerting/alerting-rules/create-cortex-loki-managed-recording-rule/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/create-cortex-loki-managed-recording-rule/
  - ../unified-alerting/alerting-rules/create-mimir-loki-managed-recording-rule/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/create-mimir-loki-managed-recording-rule/
  - ../alerting-rules/create-mimir-loki-managed-recording-rule/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-mimir-loki-managed-recording-rule/
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-recording-rules/
description: Create recording rules in Grafana Alerting
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

Recording rules calculate frequently used expressions or computationally expensive expressions in advance, and save the results as a new set of time series.

You might want to use recording rules when:

- Faster queries are needed. When performing computationally heavy aggregations or querying large data sets, querying precomputed results is faster than querying in real-time.
- System overload occurs due to multiple simultaneous queries. Precomputing certain queries in advance can reduce system load and optimize resource usage.
- Aggregations can reduce alert noise from flapping metrics. For example, aggregating noisy metrics over a longer period can help reduce alerts triggered by short spikes.
- Enable multi-step alerts where precomputing results can help speed up queries and reduce system load

Similar to alert rules, Grafana supports two types of recording rules:

1. [Grafana-managed recording rules](ref:data-source-managed-recording-rules), which can query any Grafana data source supported by alerting.
2. [Data source-managed recording rules](ref:grafana-managed-recording-rules), which can query Prometheus-based data sources like Mimir or Loki.
