---
aliases:
  - ../features/datasources/phlare/ # /docs/grafana/<GRAFANA_VERSION>/features/datasources/phlare/
  - ../features/datasources/grafana-pyroscope/ # /docs/grafana/<GRAFANA_VERSION>/features/datasources/grafana-pyroscope/
  - ../datasources/grafana-pyroscope/ # /docs/grafana/<GRAFANA_VERSION>/datasources/grafana-pyroscope/
description: Horizontally-scalable, highly-available, multi-tenant continuous profiling
  aggregation system. OSS profiling solution from Grafana Labs.
keywords:
  - phlare
  - guide
  - profiling
  - pyroscope
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Pyroscope
title: Pyroscope data source
weight: 1350
review_date: 2026-07-08
---

# Grafana Pyroscope data source

Grafana Pyroscope is a horizontally scalable, highly available, multi-tenant, OSS, continuous profiling aggregation system.
Add a Pyroscope data source to query your profiles in [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/).

Grafana includes built-in support for Pyroscope, so you don't need to install a plugin. The Pyroscope data source requires Grafana v12.3 or later.

Refer to [Introduction to Pyroscope](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/introduction/) to understand profiling and Pyroscope.

## Supported features

The Pyroscope data source supports the following features.

| Feature     | Supported |
| ----------- | --------- |
| Metrics     | Yes       |
| Logs        | No        |
| Traces      | No        |
| Alerting    | No        |
| Annotations | No        |

The Pyroscope data source returns profiling data visualized as flame graphs and time-series metrics derived from profiles. It also integrates with tracing data through the Trace to profiles feature.

## Get started

The following documents help you get started with the Pyroscope data source:

- [Configure the Grafana Pyroscope data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/pyroscope/configure/)
- [Query profile data](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/pyroscope/query-editor/)
- [Template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/pyroscope/template-variables/)
- [Troubleshoot the Pyroscope data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/pyroscope/troubleshooting/)

Before you query profiles, [configure your application to send profiles](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/configure-client/) to Pyroscope.

## Continuous profiling

While code profiling has been a long-standing practice, continuous profiling represents a modern and more advanced approach to performance monitoring.

This technique adds two critical dimensions to traditional profiles:

Time
: Profiling data is collected _continuously_, providing a time-centric view that allows querying performance data from any point in the past.

Metadata
: Profiles are enriched with metadata, adding contextual depth to the performance data.

These dimensions, coupled with the detailed nature of performance profiles, make continuous profiling a uniquely valuable tool.

### Flame graphs

Flame graphs help you visualize resource allocation and performance bottlenecks.

In Grafana Cloud, views with a flame graph include **Explain flame graph**, which uses AI to analyze the profile and explain the performance bottleneck, its root cause, and a recommended fix. Grafana Cloud also provides line-level insights through the GitHub integration.
For more information, refer to [Flame graph AI](https://grafana.com/docs/grafana-cloud/monitor-applications/profiles/flamegraph-ai/).

## Integrate profiles into dashboards

Using the Pyroscope data source, you can integrate profiles into your dashboards.
For example, you can embed flame graphs using the [flame graph panel](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/flame-graph/).

This example shows memory profiles alongside panels for logs and metrics, which helps you debug out of memory (OOM) errors together with the associated logs and metrics.

![dashboard](https://grafana.com/static/img/pyroscope/grafana-pyroscope-dashboard-2023-11-30.png)

## Visualize traces and profiles data using Traces to profiles

You can link profile and tracing data using your Pyroscope data source with the Tempo data source.

Combined traces and profiles let you see granular line-level detail when available for a trace span. This allows you to pinpoint the exact function that's causing a bottleneck in your application as well as a specific request.

![trace-profiler-view](https://grafana.com/static/img/pyroscope/pyroscope-trace-profiler-view-2023-11-30.png)

For more information, refer to [Configure Trace to profiles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/pyroscope/configure-traces-to-profiles/) and [Link tracing and profiling with span profiles](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/configure-client/trace-span-profiles/).

{{< youtube id="AG8VzfFMLxo" >}}

## Related Pyroscope documentation

For more information about Pyroscope beyond the data source, refer to the following Pyroscope product documentation:

- [Introduction to Pyroscope](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/introduction/): Understand continuous profiling and how Pyroscope works.
- [Configure the client to send profiles](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/configure-client/): Instrument your application to send profiling data to Pyroscope.
- [Link traces to profiles with span profiles](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/configure-client/trace-span-profiles/): Correlate trace spans with profiling data.
- [Deploy Pyroscope](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/deploy-kubernetes/): Deploy and run a self-managed Pyroscope backend.
- [Configure the Pyroscope server](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/configure-server/): Reference the available server configuration parameters.
