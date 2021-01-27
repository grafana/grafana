+++
title = "Preconfigred dashboards"
description = "Guide for using Google Cloud Monitoring in Grafana"
keywords = ["grafana", "stackdriver", "google", "guide", "cloud", "monitoring"]
aliases = ["/docs/grafana/latest/features/datasources/stackdriver", "/docs/grafana/latest/features/datasources/cloudmonitoring/"]
weight = 10
+++

# Preconfigured dashboards

Google Cloud Monitoring data source ships with [out-of-the-box](#out-of-the-box-dashboards) and [curated](#curated-dashboards) dashboards. See also [Using Google Cloud Monitoring in Grafana]({{< relref "_index.md" >}}) for detailed instructions on how to add and configure the data source.

## Out-of-the-box dashboards

Grafana v7.3 and later versions supports five of the most popular out-of-the-box GCP services. They are:

- BigQuery
- Cloud Load Balancing
- Cloud SQL
- Google Compute Engine `GCE`
- Google Kubernetes Engine `GKE`

To import the out-of-the-box dashboards:

1. Go to the configuration page of a Cloud monitoring data source and click on the `Dashboards` tab.

2. Click `Import` for the dashboard you would like to use.

The data source of the newly created dashboard panels will be the one selected above. The dashboards have a template variable that is populated with the projects accessible by the configured service account every time the dashboard is loaded. After the dashboard is loaded, you can select the project you prefer from the drop-down list.

In case you want to customize a dashboard, we recommend that you save it under a different name. Otherwise the dashboard will be overwritten when a new version of the dashboard is released.

{{< docs-imagebox img="/img/docs/v73/cloud-monitoring-dashboard-import.png" max-width= "700px" caption="Cloud Monitoring dashboard import" >}}

## Curated dashboards

Grafana v7.4 and later versions support some of the most popular GCP services. These curated dashboards are based on similar dashboards in the GCP dashboard samples repository.

To import the curated dashboards:

1. Go to the configuration page of your Cloud Monitoring data source and click on the `Dashboards` tab.

2. Click `Import` for the dashboard you would like to use.

In case you want to customize a dashboard, we recommend that you save it under a different name.  Otherwise the dashboard will be overwritten when a new version of the dashboard is released.

{{< docs-imagebox img="/img/docs/google-cloud-monitoring/curated-dashboards-7-4.png" max-width= "650px" >}}
