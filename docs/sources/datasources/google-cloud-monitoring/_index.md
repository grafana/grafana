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
refs:
  build-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
  alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/
  annotate-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/build-dashboards/annotate-visualizations/
  transformations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/query-transform-data/transform-data/
  visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/
  configure-gcm:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/configure/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/configure/
  query-editor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/query-editor/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/query-editor/
  template-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/template-variables/
  annotations-gcm:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/annotations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/annotations/
  alerting-gcm:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/alerting/
  google-authentication:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/google-authentication/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/google-authentication/
  troubleshooting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/troubleshooting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/google-cloud-monitoring/troubleshooting/
---

# Google Cloud Monitoring data source

Google Cloud Monitoring (formerly Stackdriver) is Google Cloud Platform's native monitoring and observability service that collects metrics, events, and metadata from GCP resources, hosted uptime probes, and application instrumentation. The Google Cloud Monitoring data source in Grafana allows you to query and visualize this data alongside metrics from other systems, creating unified dashboards for comprehensive infrastructure and application monitoring.

Grafana includes native support for the Google Cloud Monitoring plugin, so you don't need to install a plugin.

## Get started

The following documents will help you get started with the Google Cloud Monitoring data source:

- [Configure the data source](ref:configure-gcm) - Set up authentication and connect to Google Cloud
- [Query editor](ref:query-editor) - Create and edit Metric and SLO queries
- [Template variables](ref:template-variables) - Create dynamic dashboards with Google Cloud Monitoring variables
- [Annotations](ref:annotations-gcm) - Overlay Google Cloud Monitoring events on graphs
- [Alerting](ref:alerting-gcm) - Create alert rules based on GCP metrics and SLOs
- [Google authentication](ref:google-authentication) - Configure authentication methods for GCP access
- [Troubleshooting](ref:troubleshooting) - Solve common configuration and query errors

## Supported query types

The Google Cloud Monitoring data source supports the following query types:

| Query type                          | Description                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Metrics**                         | Query time series data from GCP resources using the Monitoring Query Language (MQL) or the visual builder. |
| **Service Level Objectives (SLOs)** | Query SLO data defined in Google Cloud Monitoring to track service reliability and error budgets.          |

## Additional features

After you configure the Google Cloud Monitoring data source, you can:

- Create a wide variety of [visualizations](ref:visualizations) using GCP metrics.
- Configure and use [template variables](ref:variables) for dynamic dashboards.
- Add [transformations](ref:transformations) to manipulate query results.
- Add [annotations](ref:annotate-visualizations) to overlay events on your graphs.
- Set up [alerting](ref:alerting) based on GCP metrics.
- Use [Explore](ref:explore) to investigate your Google Cloud data without building a dashboard.

## Pre-configured dashboards

The Google Cloud Monitoring data source includes pre-configured dashboards for popular GCP services. These curated dashboards are based on similar dashboards in the GCP dashboard samples repository.

{{< figure src="/static/img/docs/google-cloud-monitoring/curated-dashboards-7-4.png" class="docs-image--no-shadow" max-width="650px" caption="Curated dashboards for Google Cloud Monitoring" >}}

To import a pre-configured dashboard:

1. Go to **Connections** > **Data sources**.
1. Select your Google Cloud Monitoring data source.
1. Click the **Dashboards** tab.
1. Click **Import** next to the dashboard you want to use.

The dashboards include a [template variable](ref:template-variables) populated with the projects accessible by the configured [service account](ref:google-authentication) each time you load the dashboard. After Grafana loads the dashboard, you can select a project from the dropdown list.

To customize an imported dashboard, save it under a different name. Otherwise, Grafana upgrades can overwrite your customizations with the new version.

## Related resources

- [Google Cloud Monitoring documentation](https://cloud.google.com/monitoring/docs)
- [Monitoring Query Language (MQL) reference](https://cloud.google.com/monitoring/mql/reference)
- [Google Cloud metrics list](https://cloud.google.com/monitoring/api/metrics_gcp)
- [Grafana community forum](https://community.grafana.com/)
