+++
title = "What's New in Grafana v7.3"
description = "Feature and improvement highlights for Grafana v7.3"
keywords = ["grafana", "new", "documentation", "7.3", "release notes"]
type = "docs"
aliases = ["/docs/grafana/latest/guides/whats-new-in-v7-3/"]
[menu.docs]
name = "Version 7.3"
identifier = "v7.3"
parent = "whatsnew"
weight = -17
+++

# What's new in Grafana v7.3

This topic includes the release notes for the Grafana v7.3. For all details, read the full [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

This is a work in progress and will be updated later.

## Highlights

Grafana 7.3 comes with a number of features and enhancements:

- [**Google Cloud Monitoring:** Out of the box dashboards]({{< relref "#cloud-monitoring-out-of-the-box-dashboards" >}})

#### Cloud monitoring out-of-the-box dashboards

The updated Cloud monitoring data source is shipped with pre-configured dashboards for five of the most popular GCP services:

- BigQuery
- Cloud Load Balancing
- Cloud SQL
- Google Compute Engine `GCE`
- Google Kubernetes Engine `GKE`

To import the pre-configured dashboards, go to the configuration page of your Google Cloud Monitoring data source and click on the `Dashboards` tab. Click `Import` for the dashboard you would like to use. To customize the dashboard, we recommend to save the dashboard under a different name, because otherwise the dashboard will be overwritten when a new version of the dashboard is released.

For more details, see the [Google Cloud Monitoring docs]({{<relref "../datasources/cloudmonitoring/#out-of-the-box-dashboards">}})

## Upgrading

See [upgrade notes]({{< relref "../installation/upgrading.md" >}}).

## Changelog

Check out [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) for a complete list of new features, changes, and bug fixes.
