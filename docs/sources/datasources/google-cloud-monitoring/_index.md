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
---

# Google Cloud Monitoring data source

Google Cloud Monitoring (formerly Stackdriver) is Google Cloud Platform's native monitoring and observability service that collects metrics, events, and metadata from GCP resources, hosted uptime probes, and application instrumentation. The Google Cloud Monitoring data source in Grafana allows you to query and visualize this data alongside metrics from other systems, creating unified dashboards for comprehensive infrastructure and application monitoring.

Grafana includes built-in support for Google Cloud Monitoring, so you don't need to install a plugin.

## Get started

The following documents will help you get started with the Google Cloud Monitoring data source:

- [Configure the data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/configure/) - Set up authentication and connect to Google Cloud
- [Query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/query-editor/) - Create and edit Metric and SLO queries
- [Template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/template-variables/) - Create dynamic dashboards with Google Cloud Monitoring variables
- [Annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/annotations/) - Overlay Google Cloud Monitoring events on graphs
- [Alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/alerting/) - Create alert rules based on GCP metrics and SLOs
- [Google authentication](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/google-authentication/) - Configure authentication methods for GCP access
- [Troubleshooting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/troubleshooting/) - Solve common configuration and query errors

## Supported query types

The Google Cloud Monitoring data source supports the following query types:

| Query type                          | Description                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Metrics**                         | Query time series data from GCP resources using the Monitoring Query Language (MQL) or the visual builder. |
| **Service Level Objectives (SLOs)** | Query SLO data defined in Google Cloud Monitoring to track service reliability and error budgets.          |

## Additional features

After you configure the Google Cloud Monitoring data source, you can:

- Create a wide variety of [visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/) using GCP metrics.
- Configure and use [template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) for dynamic dashboards.
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/) to manipulate query results.
- Add [annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/) to overlay events on your graphs.
- Set up [alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/) based on GCP metrics.
- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to investigate your Google Cloud data without building a dashboard.

## Pre-configured dashboards

The Google Cloud Monitoring data source includes pre-configured dashboards for popular GCP services. These curated dashboards are based on similar dashboards in the GCP dashboard samples repository.

{{< figure src="/static/img/docs/google-cloud-monitoring/curated-dashboards-7-4.png" class="docs-image--no-shadow" max-width="650px" caption="Curated dashboards for Google Cloud Monitoring" >}}

To import a pre-configured dashboard:

1. Go to **Connections** > **Data sources**.
1. Select your Google Cloud Monitoring data source.
1. Click the **Dashboards** tab.
1. Click **Import** next to the dashboard you want to use.

The dashboards include a [template variable](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/template-variables/) populated with the projects accessible by the configured [service account](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/google-authentication/) each time you load the dashboard. After Grafana loads the dashboard, you can select a project from the dropdown list.

To customize an imported dashboard, save it under a different name. Otherwise, Grafana upgrades can overwrite your customizations with the new version.

## Related resources

- [Google Cloud Monitoring documentation](https://cloud.google.com/monitoring/docs)
- [Monitoring Query Language (MQL) reference](https://cloud.google.com/monitoring/mql/reference)
- [Google Cloud metrics list](https://cloud.google.com/monitoring/api/metrics_gcp)
- [Grafana community forum](https://community.grafana.com/)
