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
---

# Google Cloud Monitoring data source

Grafana ships with built-in support for Google Cloud Monitoring.
This topic describes queries, templates, variables, and other configuration specific to the Google Cloud Monitoring data source.

For instructions on how to add a data source to Grafana, refer to the [administration documentation](ref:data-source-management).
Only users with the organization administrator role can add data sources.

Once you've added the Google Cloud Monitoring data source, you can [configure it](#configure-the-data-source) so that your Grafana instance's users can create queries in its [query editor](query-editor/) and apply [annotations](#annotations) when they [build dashboards](ref:build-dashboards) and use [Explore](ref:explore).

## Pre-configured dashboards

The Google Cloud Monitoring data source ships with pre-configured dashboards for some of the most popular GCP services.
These curated dashboards are based on similar dashboards in the GCP dashboard samples repository.

{{< figure src="/static/img/docs/google-cloud-monitoring/curated-dashboards-7-4.png" class="docs-image--no-shadow" max-width="650px" caption="Curated dashboards for Google Cloud Monitoring" >}}

**To import curated dashboards:**

1. Navigate to the data source's [configuration page](#configure-the-data-source).
1. Select the **Dashboards** tab.

   This displays the curated selection of importable dashboards.

1. Select **Import** for the dashboard to import.

The dashboards include a [template variable](template-variables/) populated with the projects accessible by the configured [Service Account](google-authentication/) each time you load the dashboard.
After Grafana loads the dashboard, you can select a project from the dropdown list.

**To customize an imported dashboard:**

To customize one of these dashboards, we recommend that you save it under a different name.
If you don't, upgrading Grafana can overwrite the customized dashboard with the new version.


## Query the data source

The Google Cloud Monitoring query editor helps you build two types of queries: **Metric** and **Service Level Objective (SLO)**.

For details, refer to the [query editor documentation](query-editor/).

## Use template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For details, see the [template variables documentation](template-variables/).
