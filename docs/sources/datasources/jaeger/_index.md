---
aliases:
  - ../data-sources/jaeger/
  - ../features/datasources/jaeger/
description: Guide for using the Jaeger data source in Grafana
keywords:
  - grafana
  - jaeger
  - tracing
  - distributed tracing
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Jaeger
title: Jaeger data source
weight: 800
review_date: 2026-03-03
---

# Jaeger data source

Grafana ships with built-in support for [Jaeger](https://www.jaegertracing.io/), an open source, end-to-end distributed tracing system. Use the Jaeger data source to query and visualize traces, explore service dependencies, and correlate traces with logs and metrics.

## Supported features

| Feature     | Supported |
| ----------- | --------- |
| Traces      | Yes       |
| Metrics     | No        |
| Logs        | No        |
| Alerting    | No        |
| Annotations | No        |

## Get started

The following documents help you set up and use the Jaeger data source:

- [Configure the Jaeger data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/jaeger/configure/)
- [Jaeger query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/jaeger/query-editor/)
- [Troubleshoot Jaeger data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/jaeger/troubleshooting/)

## Additional features

After configuring the data source, you can:

- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to query traces without building a dashboard.
- Enable the [Node Graph visualization](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/node-graph/) to display trace structure and service dependencies.
- Configure [trace to logs](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/jaeger/configure/#trace-to-logs) to link spans to log entries in Loki or Splunk.
- Configure [trace to metrics](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/jaeger/configure/#trace-to-metrics) to navigate from traces to related metrics.
- Link to Jaeger traces from [logs](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure-loki-data-source/#derived-fields) using derived fields or from [metrics](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/) using exemplars.

## Related resources

- [Official Jaeger documentation](https://www.jaegertracing.io/docs/)
- [Grafana community forum](https://community.grafana.com/)
