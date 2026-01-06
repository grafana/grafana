---
aliases:
  - ../data-sources/loki/
  - ../features/datasources/loki/
description: Guide for using Loki in Grafana
keywords:
  - grafana
  - loki
  - logging
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Loki
title: Loki data source
weight: 800
refs:
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  build-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  logs-integration-labels-and-detected-fields:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/logs-integration/#labels-and-detected-fields
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/logs-integration/#labels-and-detected-fields
  visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/
  transformations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/transform-data/
  alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/
  annotate-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/annotate-visualizations/
  loki-annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/annotations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/annotations/
  import-dashboard:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/import-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/import-dashboards/
---

# Loki data source

Grafana Loki is a log aggregation system that stores and queries logs from your applications and infrastructure. Unlike traditional logging systems, Loki indexes only metadata (labels) about your logs rather than the full text. Log data is compressed and stored in object stores such as Amazon S3 or Google Cloud Storage, or locally on a filesystem.

You can use this data source to query, visualize, and alert on log data stored in Loki.

## Supported Loki versions

This data source supports Loki v2.9 and later.

## Key capabilities

The Loki data source provides the following capabilities:

- **Log queries:** Query and filter logs using [LogQL](https://grafana.com/docs/loki/latest/logql/), Loki's query language inspired by PromQL.
- **Metric queries:** Extract metrics from log data using LogQL metric queries, enabling you to count log events, calculate rates, and aggregate values.
- **Live tailing:** Stream logs in real time as they're ingested into Loki.
- **Derived fields:** Create links from log lines to external systems such as tracing backends, allowing you to jump directly from a log entry to a related trace.
- **Annotations:** Overlay log events on time series graphs to correlate logs with metrics.
- **Alerting:** Create alert rules based on log queries to notify you when specific patterns or thresholds are detected.

## Get started

The following documentation helps you get started with the Loki data source:

- [Configure the Loki data source](configure/)
- [Loki query editor](query-editor/)
- [Loki template variables](template-variables/)
- [Troubleshoot the Loki data source](troubleshooting/)

For more information about Loki itself, refer to the [Loki documentation](https://grafana.com/docs/loki/latest/):

- [Get started with Loki](https://grafana.com/docs/loki/latest/get-started/)
- [Install Loki](https://grafana.com/docs/loki/latest/installation/)
- [Loki best practices](https://grafana.com/docs/loki/latest/best-practices/#best-practices)
- [LogQL query language](https://grafana.com/docs/loki/latest/logql/)

## Additional features

After you configure the Loki data source, you can:

- Create [visualizations](ref:visualizations) to display your log data
- Configure and use [templates and variables](ref:variables) for dynamic dashboards
- Add [transformations](ref:transformations) to process query results
- Add [annotations](ref:loki-annotations) to overlay log events on graphs
- Set up [alerting](ref:alerting) to monitor your log data
- Use [Explore](ref:explore) for ad-hoc log queries and analysis
- Configure [derived fields](configure/#derived-fields) to link logs to traces or other data sources

## Community dashboards

Grafana doesn't ship pre-configured dashboards with the Loki data source, but you can find community-contributed dashboards on [Grafana Dashboards](https://grafana.com/grafana/dashboards/?dataSource=loki). These dashboards provide ready-made visualizations for common Loki use cases.

To import a community dashboard:

1. Find a dashboard on [grafana.com/grafana/dashboards](https://grafana.com/grafana/dashboards/?dataSource=loki).
1. Copy the dashboard ID.
1. In Grafana, go to **Dashboards** > **New** > **Import**.
1. Paste the dashboard ID and click **Load**.

For more information, refer to [Import a dashboard](ref:import-dashboard).

## Related data sources

Loki integrates with other Grafana data sources to provide full observability across logs, metrics, and traces:

- **Tempo:** Use [derived fields](configure/#derived-fields) to create links from log lines to traces in Tempo, enabling seamless navigation from logs to distributed traces.
- **Prometheus and Mimir:** Display logs alongside metrics on the same dashboard to correlate application behavior with performance data.

For more information about building observability workflows, refer to the [Grafana Tempo documentation](https://grafana.com/docs/tempo/latest/) and [Grafana Mimir documentation](https://grafana.com/docs/mimir/latest/).
