---
aliases:
  - ../data-sources/zipkin/
  - ../data-sources/zipkin/query-editor/
description: Guide for using the Zipkin data source in Grafana
keywords:
  - grafana
  - zipkin
  - tracing
  - distributed tracing
  - querying
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Zipkin
title: Zipkin data source
weight: 1600
review_date: 2026-08-11
---

# Zipkin data source

When a request slows to a crawl or fails somewhere deep in your microservices, [Zipkin](https://zipkin.io/) shows you exactly where. Zipkin is an open source distributed tracing system that follows a request as it hops from service to service, so you can pinpoint the bottleneck instead of guessing.

The Zipkin data source brings those traces straight into Grafana. Query and visualize them alongside your logs and metrics to find latency bottlenecks, follow requests across services, and map the dependencies between them. Grafana ships with the data source preinstalled, so you can start exploring traces right away.

As of Grafana 13.2, Zipkin is packaged as a standalone plugin so it can receive updates independently of Grafana releases. For details, refer to [Plugin updates](#plugin-updates).

## Supported features

| Feature     | Supported |
| ----------- | --------- |
| Traces      | Yes       |
| Metrics     | No        |
| Logs        | No        |
| Alerting    | No        |
| Annotations | No        |

## Get started

The following pages help you get started with the Zipkin data source:

- [Configure the Zipkin data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/configure/)
- [Zipkin query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/query-editor/)
- [Template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/template-variables/)
- [Troubleshooting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/troubleshooting/)

## Additional features

After configuring the data source, you can:

- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to query traces without building a dashboard
- Navigate from traces to related logs with [trace to logs](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/configure/#trace-to-logs) integration
- Navigate from traces to related metrics with [trace to metrics](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/configure/#trace-to-metrics) integration
- Enable the [Node graph](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/node-graph/) visualization to view service dependencies
- Add [Transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/) to manipulate query results

## Plugin updates

Starting with Grafana v13.2, the Zipkin data source is a standalone plugin, preinstalled in both Grafana OSS and Enterprise. This enables more frequent updates independent of Grafana releases. Grafana automatically checks the plugin catalog and installs the latest version on each server restart.

To adjust this behavior:

- **Opt out of auto-updates:** Set `preinstall_auto_update` to `false` in your [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/).
- **Update manually:** Update at any time from the **Administration > Plugins** page without restarting Grafana.

The standalone plugin requires Grafana 12.3.0 or later. The Zipkin data source bundled with Grafana 13.1 and earlier continues to work as before. These versions are unaffected by the externalization.

Users running Grafana 12.3.x through 13.1.x can install the standalone plugin from the plugin catalog if they want the latest features before upgrading to Grafana 13.2. To use the standalone plugin with these versions, add the following to your [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/):

```ini
[plugin.zipkin]
as_external = true

[plugins]
; Install the latest version on startup:
preinstall_sync = zipkin
; Or install a specific version:
; preinstall_sync = zipkin@<version>
```

{{< admonition type="note" >}}
On Grafana Cloud, the Zipkin plugin is managed by Grafana and updates automatically.
{{< /admonition >}}

## Related resources

- [Official Zipkin documentation](https://zipkin.io/)
- [Grafana community forum](https://community.grafana.com/)
