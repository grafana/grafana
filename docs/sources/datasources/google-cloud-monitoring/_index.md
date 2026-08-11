---
aliases:
  - ../data-sources/google-cloud-monitoring/
  - ../data-sources/google-cloud-monitoring/preconfig-cloud-monitoring-dashboards/
  - ../features/datasources/cloudmonitoring/
  - ../features/datasources/stackdriver/
  - cloudmonitoring/
  - preconfig-cloud-monitoring-dashboards/
description: Guide for using Google Cloud Monitoring in Grafana
keywords:
  - grafana
  - stackdriver
  - google
  - guide
  - cloud
  - monitoring
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Google Cloud Monitoring
title: Google Cloud Monitoring data source
weight: 350
review_date: 2026-08-11
---

# Google Cloud Monitoring data source

Google Cloud Monitoring (formerly Stackdriver) is Google Cloud Platform's native monitoring and observability service that collects metrics, events, and metadata from GCP resources, hosted uptime probes, and application instrumentation. The Google Cloud Monitoring data source in Grafana allows you to query and visualize this data alongside metrics from other systems, creating unified dashboards for comprehensive infrastructure and application monitoring.

Grafana ships with the Google Cloud Monitoring data source preinstalled in both Grafana OSS and Grafana Enterprise, so there's nothing for you to install. It's packaged as a standalone plugin that updates independently of Grafana releases. For details, refer to [Plugin updates](#plugin-updates).

## Get started

The following documents help you get started with the Google Cloud Monitoring data source:

- [Configure the data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/configure/) - Set up authentication and connect to Google Cloud
- [Query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/query-editor/) - Create and edit Metrics, SLO, and PromQL queries
- [Template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/template-variables/) - Create dynamic dashboards with Google Cloud Monitoring variables
- [Annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/annotations/) - Overlay Google Cloud Monitoring events on graphs
- [Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/alerting/) - Create alert rules based on GCP metrics and SLOs
- [Google authentication](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/google-authentication/) - Configure authentication methods for GCP access
- [Troubleshooting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/troubleshooting/) - Solve common configuration and query errors

## Supported query types

The Google Cloud Monitoring data source supports the following query types:

| Query type                          | Description                                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Metrics**                         | Query time series data from GCP resources using the visual builder or the Monitoring Query Language (MQL).   |
| **Service Level Objectives (SLOs)** | Query SLO data defined in Google Cloud Monitoring to track service reliability and error budgets.           |
| **PromQL**                          | Query Google Cloud Monitoring metrics using Prometheus Query Language (PromQL) syntax.                       |

## Additional features

After you configure the Google Cloud Monitoring data source, you can:

- Create a wide variety of [visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/) using GCP metrics.
- Configure and use [template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) for dynamic dashboards.
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/) to manipulate query results.
- Add [annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/) to overlay events on your graphs.
- Set up [alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/) based on GCP metrics.
- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to investigate your Google Cloud data without building a dashboard.

## Import dashboards for GCP services

The Google Cloud Monitoring plugin no longer bundles pre-configured dashboards. Earlier versions shipped curated dashboards for popular GCP services that you imported from the data source's **Dashboards** tab. As of plugin version 12.6.1, these dashboards are no longer included, so the **Dashboards** tab doesn't list them.

To build equivalent dashboards, do one of the following:

- Browse the [Grafana dashboards catalog](https://grafana.com/grafana/dashboards/?dataSource=stackdriver) for community and Grafana-authored dashboards that use the Google Cloud Monitoring data source.
- Reference the [Google Cloud dashboard samples](https://github.com/GoogleCloudPlatform/monitoring-dashboard-samples) and recreate the panels using the [query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/query-editor/).

When you build dashboards for multiple GCP projects, add a [template variable](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/template-variables/) populated with the projects accessible by the configured [service account](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/google-authentication/) so you can switch projects from a drop-down.

## Plugin updates

Starting with Grafana v13.2, the Google Cloud Monitoring data source is a standalone plugin, preinstalled in both Grafana OSS and Grafana Enterprise. This enables more frequent updates independent of Grafana releases. Grafana automatically checks the plugin catalog and installs the latest version on each server restart.

To adjust this behavior:

- **Opt out of auto-updates:** Set `preinstall_auto_update` to `false` in your [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/).
- **Update manually:** Update at any time from the **Administration > Plugins** page without restarting Grafana.

The standalone plugin requires Grafana 12.3.0 or later. The Google Cloud Monitoring data source bundled with Grafana 12.2 and earlier continues to work as before. These versions are unaffected by the change.

Users running Grafana 12.3.x through 13.1.x can install the standalone plugin from the plugin catalog if they want the latest features before upgrading to Grafana 13.2. To use the standalone plugin with these versions, add the following to your [configuration file](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/):

```ini
[plugin.stackdriver]
as_external = true

[plugins]
; Install the latest version on startup:
preinstall_sync = stackdriver
; Or install a specific version:
; preinstall_sync = stackdriver@<version>
```

## Related resources

- [Google Cloud Monitoring documentation](https://cloud.google.com/monitoring/docs)
- [Monitoring Query Language (MQL) reference](https://cloud.google.com/monitoring/mql/reference)
- [Google Cloud metrics list](https://cloud.google.com/monitoring/api/metrics_gcp)
- [Grafana community forum](https://community.grafana.com/)
