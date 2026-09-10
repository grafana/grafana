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
review_date: 2026-09-10
---

# Tempo data source

Grafana ships preinstalled with the Tempo data source for [Grafana Tempo](https://grafana.com/docs/tempo/<TEMPO_VERSION>/), a high-volume, minimal-dependency distributed tracing backend from Grafana Labs. There's nothing to install to get started.
Use the Tempo data source to search and visualize traces, correlate traces with logs, metrics, and profiles, and monitor service dependencies with the Service Graph.

As of Grafana 13.2, Tempo is packaged as a standalone plugin so it can receive updates independently of Grafana releases. For details, refer to [Plugin updates](#plugin-updates).

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
| Alerting           | Experimental | Enable the `tempoAlerting` feature toggle to alert on TraceQL metrics queries, or use Prometheus metrics from the metrics generator |

{{< admonition type="tip" >}}
**New to tracing?** Learn what telemetry signals are and how they work together in [Understand your data](https://grafana.com/docs/grafana-cloud/telemetry-signals/) (Grafana Cloud), or read the [Introduction to tracing](https://grafana.com/docs/tempo/<TEMPO_VERSION>/introduction/) for core concepts like spans, traces, and instrumentation.

**Prefer a queryless experience?** [Grafana Traces Drilldown](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/simplified-exploration/traces/) lets you explore tracing data using RED metrics without writing TraceQL queries.
{{< /admonition >}}

## Get started

The following pages help you set up and use the Tempo data source:

- [Configure the Tempo data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/): Connect Grafana to Tempo, set up authentication, and configure trace correlations.
- [Query tracing data](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/query-editor/): Search for traces, use the TraceQL editor, and upload JSON trace files.
- [Grafana Traces Drilldown](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/simplified-exploration/traces/): Explore tracing data visually using RED metrics, without writing queries.
- [Service Graph and Service Graph view](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/service-graph/): Visualize service dependencies and monitor request rate, error rate, and duration. Requires a linked Prometheus data source with service graph metrics.

## Connect traces to other signals

After you've connected Grafana to Tempo, you can configure correlations between traces and other signals:

- [Trace to logs](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-logs/): Navigate from spans to related logs in Loki, including bidirectional linking.
- [Trace to metrics](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-metrics/): Link spans to metrics queries in Prometheus or other metrics data sources.
- [Trace to profiles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/configure-trace-to-profiles/): Link spans to profiling data in Grafana Pyroscope with embedded flame graphs.
- [Trace correlations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/trace-correlations/): Create custom correlation links to any data source or external URL.

## Plugin updates

Starting with Grafana v13.2, the Tempo data source is a standalone plugin, preinstalled in both Grafana OSS and Enterprise. This enables more frequent updates independent of Grafana releases. Grafana automatically checks the plugin catalog and installs the latest version on each server restart.

To adjust this behavior:

- **Opt out of auto-updates:** Set `preinstall_auto_update` to `false` in your [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/).
- **Update manually:** Update at any time from the **Administration > Plugins** page without restarting Grafana.

The standalone plugin requires Grafana 12.3.0 or later. The Tempo data source bundled with Grafana 13.1 and earlier continues to work as before. These versions are unaffected by the externalization.

Users running Grafana 12.3.x through 13.1.x can install the standalone plugin from the plugin catalog if they want the latest features before upgrading to Grafana 13.2. To use the standalone plugin with these versions, add the following to your [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/):

```ini
[plugin.tempo]
as_external = true

[plugins]
; Install the latest version on startup:
preinstall_sync = tempo
; Or install a specific version:
; preinstall_sync = tempo@<version>
```

{{< admonition type="note" >}}
On Grafana Cloud, the Tempo plugin is managed by Grafana and updates automatically.
{{< /admonition >}}

## Related resources

- [Introduction to tracing](https://grafana.com/docs/tempo/<TEMPO_VERSION>/introduction/)
- [Best practices for traces](https://grafana.com/docs/tempo/<TEMPO_VERSION>/set-up-for-tracing/instrument-send/best-practices/): Guidance on planning spans, attributes, and trace structure for effective tracing data.
- [TraceQL query examples](query-editor/traceql-query-examples/)
- [TraceQL query language reference](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql/)
  If you encounter issues with the Tempo data source, refer to [Troubleshoot Tempo data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/troubleshooting/).

{{< section withDescriptions="true">}}
