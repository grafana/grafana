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
review_date: 2026-08-11
---

# Jaeger data source

[Jaeger](https://www.jaegertracing.io/) is an open source, end-to-end distributed tracing system. Use the Jaeger data source to query and visualize traces, explore service dependencies, and correlate traces with logs and metrics.

Grafana ships with the Jaeger data source preinstalled in both Grafana OSS and Enterprise, so there's nothing to install. It's packaged as a standalone plugin that updates independently of Grafana releases. For more information, refer to [Plugin updates](#plugin-updates).

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

## Plugin updates

Starting with Grafana v13.2, the Jaeger data source is a standalone plugin, preinstalled in both Grafana OSS and Enterprise. This lets the data source receive updates independently of Grafana releases. Grafana automatically checks the plugin catalog and installs the latest version on each server restart.

To adjust this behavior:

- **Opt out of auto-updates:** Set `preinstall_auto_update` to `false` in your [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/).
- **Update manually:** Update at any time from the **Administration > Plugins** page without restarting Grafana.

The standalone plugin requires Grafana 12.3.0 or later. The Jaeger data source bundled with Grafana 12.2 and earlier continues to work as before. These versions are unaffected by the change.

If you run Grafana 12.3.x through 13.1.x, you can install the standalone plugin from the plugin catalog to get the latest features before you upgrade to Grafana 13.2. To use the standalone plugin with these versions, add the following to your [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/):

```ini
[plugin.jaeger]
as_external = true

[plugins]
; Install the latest version on startup:
preinstall_sync = jaeger
; Or install a specific version:
; preinstall_sync = jaeger@<version>
```

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
