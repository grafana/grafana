---
aliases:
  - ../features/datasources/parca/
  - ../parca/
description: Guide for using the Parca data source in Grafana for continuous profiling
  analysis of CPU and memory usage.
keywords:
  - grafana
  - parca
  - profiling
  - continuous profiling
  - flame graph
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Parca
title: Parca data source
weight: 1110
review_date: 2026-04-10
---

# Parca data source

Parca is a continuous profiling database for analysis of CPU and memory usage, down to the line number and throughout time. Grafana ships with built-in support for Parca, so you can add it as a data source and start querying your profiles in [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/).

## Supported Parca versions

This data source supports Parca v0.19 and later.

## Supported features

| Feature     | Supported |
| ----------- | --------- |
| Profiles    | Yes       |
| Metrics     | Yes       |
| Alerting    | No        |
| Annotations | No        |

## Get started

The following pages help you get started with the Parca data source:

- [Configure the Parca data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/configure/)
- [Parca query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/query-editor/)
- [Troubleshoot Parca data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/troubleshooting/)

## Integrate profiles into dashboards

Using the Parca data source, you can integrate profiles into your dashboards.
Embed flame graphs using the [flame graph panel](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/flame-graph/).

## Provision the Parca data source

You can define and manage the data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning, refer to [Provisioning Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources).

Here is an example configuration:

```yaml
apiVersion: 1

datasources:
  - name: Parca
    type: parca
    url: http://localhost:7070
```

## Plugin updates

Always ensure that your plugin version is up-to-date so you have access to all current features and improvements. Navigate to **Plugins and data** > **Plugins** to check for updates. Grafana recommends upgrading to the latest Grafana version, and this applies to plugins as well.

{{< admonition type="note" >}}
Plugins are automatically updated in Grafana Cloud.
{{< /admonition >}}

## Related resources

- [Official Parca documentation](https://www.parca.dev/docs)
- [Grafana community forum](https://community.grafana.com/)
