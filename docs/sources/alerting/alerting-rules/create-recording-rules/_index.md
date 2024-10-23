---
aliases:
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
  configure-grafana:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/
  annotation-label:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/
---

# Configure recording rules

Recording rules calculate frequently needed expressions or computationally expensive expressions in advance and save the result as a new set of time series. Querying this new time series is faster, especially for dashboards since they query the same expression every time the dashboards refresh.

Grafana-managed recording rules offer the same Prometheus-like semantics, but allow you to query any Grafana data source supported by alerting. In addition to the above, you can use this to import and map data from other data sources into Prometheus.

For more information on recording rules in Prometheus, refer to [Defining recording rules in Prometheus](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/).

- Create data source-managed recording rules.

- Create Grafana-managed recording rules.
