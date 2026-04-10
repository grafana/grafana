---
aliases:
  - ../data-sources/tempo/
  - ../features/datasources/tempo/
  - tracing-best-practices/
  - traces-in-grafana/
description: Guide for using Tempo in Grafana
keywords:
  - grafana
  - tempo
  - guide
  - tracing
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Tempo
title: Tempo data source
weight: 1400
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
  node-graph:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/node-graph/
    - pattern: /docs/grafana-cloud/
      destination: https://grafana.com/docs/grafana-cloud/visualizations/panels-visualizations/visualizations/node-graph/
  configure-tempo-data-source:
    - pattern: /docs/grafana/
      destination: https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/#provision-the-data-source
    - pattern: /docs/grafana-cloud/
      destination: https://grafana.com/docs/grafana-cloud/connect-externally-hosted/data-sources/tempo/configure-tempo-data-source/
  exemplars:
    - pattern: /docs/grafana/
      destination: https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/
    - pattern: /docs/grafana-cloud/
      destination: https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/
  variable-syntax:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/
    - pattern: /docs/grafana-cloud/
      destination: https://grafana.com/docs/grafana-cloud/visualizations/dashboards/variables/variable-syntax/
  explore-trace-integration:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/trace-integration/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/trace-integration/
  configure-grafana-feature-toggles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles
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
  troubleshooting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/tempo/troubleshooting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/tempo/troubleshooting/
---

# Tempo data source

Grafana ships with built-in support for [Grafana Tempo](https://grafana.com/docs/tempo/<TEMPO_VERSION>/), a high-volume, minimal-dependency distributed tracing backend from Grafana Labs.
Use the Tempo data source to search and visualize traces, correlate traces with logs, metrics, and profiles, and monitor service dependencies with the Service Graph.

Want to learn more about traces and the other telemetry signals?
Refer to [Understand your data](https://grafana.com/docs/grafana-cloud/telemetry-signals/).

{{< admonition type="note" >}}
**Grafana Cloud users:** Grafana Cloud includes [Grafana Cloud Traces](https://grafana.com/docs/grafana-cloud/send-data/traces/), a pre-configured tracing data source backed by Tempo. You can use Grafana Cloud Traces to query traces without additional setup. Use the Tempo data source when you need to connect to a self-managed Tempo instance or require custom configuration such as trace correlations.
{{< /admonition >}}

## Supported features

The Tempo data source supports the following features:

| Feature            | Supported | Notes                                                                  |
| ------------------ | --------- | ---------------------------------------------------------------------- |
| TraceQL queries    | Yes       | Query traces using TraceQL, the query language designed for traces     |
| Search             | Yes       | Find traces by service name, span name, duration, and attributes       |
| Service Graph      | Yes       | Visualize service dependencies and RED metrics                         |
| Trace to logs      | Yes       | Navigate from spans to related logs in Loki and other log data sources |
| Trace to metrics   | Yes       | Link spans to metrics queries in Prometheus                            |
| Trace to profiles  | Yes       | Link spans to profiling data in Grafana Pyroscope                      |
| Trace correlations | Yes       | Embed custom correlation links in trace views                          |
| Streaming          | Yes       | Display TraceQL results as they become available                       |
| JSON trace upload  | Yes       | Upload and visualize trace files without a Tempo instance              |
| Explore            | Yes       | Ad-hoc trace investigation without dashboards                          |
| Alerting           | No        | Use TraceQL metrics in Prometheus for trace-based alerting             |

{{< admonition type="tip" >}}
**New to tracing?** Learn what telemetry signals are and how they work together in [Understand your data](https://grafana.com/docs/grafana-cloud/telemetry-signals/) (Grafana Cloud), or read the [Introduction to tracing](https://grafana.com/docs/tempo/<TEMPO_VERSION>/introduction/) for core concepts like spans, traces, and instrumentation.

**Prefer a queryless experience?** [Grafana Traces Drilldown](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/simplified-exploration/traces/) lets you explore tracing data using RED metrics without writing TraceQL queries.
{{< /admonition >}}

## Get started

The following pages help you set up and use the Tempo data source:

- [Configure the Tempo data source](configure-tempo-data-source/): Connect Grafana to Tempo, set up authentication, and configure trace correlations.
- [Query tracing data](query-editor/): Search for traces, use the TraceQL editor, and upload JSON trace files.
- [Grafana Traces Drilldown](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/simplified-exploration/traces/): Explore tracing data visually using RED metrics, without writing queries.
- [Service Graph and Service Graph view](service-graph/): Visualize service dependencies and monitor request rate, error rate, and duration. Requires a linked Prometheus data source with service graph metrics.

## Connect traces to other signals

After you've connected Grafana to Tempo, you can configure correlations between traces and other signals:

- [Trace to logs](configure-tempo-data-source/configure-trace-to-logs/): Navigate from spans to related logs in Loki, including bidirectional linking.
- [Trace to metrics](configure-tempo-data-source/configure-trace-to-metrics/): Link spans to metrics queries in Prometheus or other metrics data sources.
- [Trace to profiles](configure-tempo-data-source/configure-trace-to-profiles/): Link spans to profiling data in Grafana Pyroscope with embedded flame graphs.
- [Trace correlations](configure-tempo-data-source/trace-correlations/): Create custom correlation links to any data source or external URL.

## Related resources

- [Introduction to tracing](https://grafana.com/docs/tempo/<TEMPO_VERSION>/introduction/)
- [Best practices for traces](https://grafana.com/docs/tempo/<TEMPO_VERSION>/set-up-for-tracing/instrument-send/best-practices/): Guidance on planning spans, attributes, and trace structure for effective tracing data.
- [TraceQL query examples](query-editor/traceql-query-examples/)
- [TraceQL query language reference](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql/)
  If you encounter issues with the Tempo data source, refer to [Troubleshoot Tempo data source issues](ref:troubleshooting).

{{< section withDescriptions="true">}}
