---
aliases:
  - ../features/datasources/phlare/ # /docs/grafana/<GRAFANA_VERSION>/features/datasources/phlare/
  - ../features/datasources/grafana-pyroscope/ # /docs/grafana/<GRAFANA_VERSION>/features/datasources/grafana-pyroscope/
  - ../datasources/grafana-pyroscope/ # /docs/grafana/<GRAFANA_VERSION>/datasources/grafana-pyroscope/
description: Horizontally-scalable, highly-available, multi-tenant continuous profiling
  aggregation system. OSS profiling solution from Grafana Labs.
keywords:
  - grafana
  - phlare
  - guide
  - profiling
  - pyroscope
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Pyroscope
weight: 1350
refs:
  flame-graph:
    - pattern: /docs/grafana/
      destination: https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/flame-graph/
    - pattern: /docs/grafana-cloud/
      destination: https://grafana.com/docs/grafana-cloud/visualizations/panels-visualizations/visualizations/flame-graph/
  configure-tempo-data-source:
    - pattern: /docs/grafana/
      destination: https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/
    - pattern: /docs/grafana-cloud/
      destination: https://grafana.com/docs/grafana-cloud/connect-externally-hosted/data-sources/tempo/configure-tempo-data-source/
  explore:
    - pattern: /docs/grafana/
      destination: https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#datasources
    - pattern: /docs/grafana-cloud/
      destination: https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#datasources
---

# Grafana Pyroscope data source

Grafana Pyroscope is a horizontally scalable, highly available, multi-tenant, OSS, continuous profiling aggregation system. Add it as a data source, and you are ready to query your profiles in [Explore](ref:explore).

Refer to [Introduction to Pyroscope](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/introduction/) to understand profiling and Pyroscope.

To use profiling data, you should:

- [Configure your application to send profiles](/docs/pyroscope/<PYROSCOPE_VERSION>/configure-client/)
- [Configure the Grafana Pyroscope data source](./configure-pyroscope-data-source/).
- [View and query profiling data in Explore](./query-profile-data/)

## Integrate profiles into dashboards

Using the Pyroscope data source, you can integrate profiles into your dashboards.
In this case, the screenshot shows memory profiles alongside panels for logs and metrics to be able to debug out of memory (OOM) errors alongside the associated logs and metrics.

![dashboard](https://grafana.com/static/img/pyroscope/grafana-pyroscope-dashboard-2023-11-30.png)

## Visualize traces and profiles data using Traces to profiles

You can link profile and tracing data using your Pyroscope data source with the Tempo data source.
To learn more about how profiles and tracing can work together, refer to [Profiling and tracing synergies](./profiling-and-tracing/).

Combined traces and profiles let you see granular line-level detail when available for a trace span. This allows you pinpoint the exact function that's causing a bottleneck in your application as well as a specific request.

![trace-profiler-view](https://grafana.com/static/img/pyroscope/pyroscope-trace-profiler-view-2023-11-30.png)

For more information, refer to the [Traces to profile section](ref:configure-tempo-data-source) and [Link tracing and profiling with span profiles](https://grafana.com/docs/pyroscope/<PYROSCOPE_VERSION>/configure-client/trace-span-profiles/).

{{< youtube id="AG8VzfFMLxo" >}}

## Provision the Pyroscope data source

You can modify the Grafana configuration files to provision the Pyroscope data source.
To learn more, and to view the available provisioning settings, refer to [provisioning documentation](ref:provisioning-data-sources).

Here is an example configuration:

```yaml
apiVersion: 1

datasources:
  - name: Grafana Pyroscope
    type: grafana-pyroscope-datasource
    url: http://localhost:4040
    jsonData:
      minStep: '15s'
```
