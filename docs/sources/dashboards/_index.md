---
aliases:
  - features/dashboard/dashboards/
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Dashboards
weight: 70
description: Create and manage dashboards
---

# Dashboards

A dashboard is a set of one or more [panels][] organized and arranged into one or more rows. Grafana ships with a variety of panels making it easy to construct the right queries, and customize the visualization so that you can create the perfect dashboard for your need. Each panel can interact with data from any configured Grafana [data source][].

Dashboard snapshots are static. Queries and expressions cannot be re-executed from snapshots. As a result, if you update any variables in your query or expression, it will not change your dashboard data.

Before you begin, ensure that you have configured a data source. See also:

- [Use dashboards][]
- [Build dashboards][]
- [Create dashboard folders][]
- [Manage dashboards][]
- [Public dashboards][]
- [Annotations][]
- [Playlist][]
- [Reporting][]
- [Version history][]
- [Import][]
- [Export and share][]
- [JSON model][]

{{% docs/reference %}}
[data source]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/datasources"
[data source]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/connect-externally-hosted/data-sources"

[Reporting]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/create-reports"
[Reporting]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/create-reports"

[Public dashboards]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/dashboard-public"
[Public dashboards]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/dashboard-public"

[Version history]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/build-dashboards/manage-version-history"
[Version history]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/build-dashboards/manage-version-history"

[panels]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations"
[panels]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations"

[Annotations]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/build-dashboards/annotate-visualizations"
[Annotations]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/build-dashboards/annotate-visualizations"

[Create dashboard folders]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/manage-dashboards#create-a-dashboard-folder"
[Create dashboard folders]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/manage-dashboards#create-a-dashboard-folder"

[JSON model]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/build-dashboards/view-dashboard-json-model"
[JSON model]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/build-dashboards/view-dashboard-json-model"

[Import]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/build-dashboards/import-dashboards"
[Import]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/build-dashboards/import-dashboards"

[Export and share]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/share-dashboards-panels"
[Export and share]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/share-dashboards-panels"

[Manage dashboards]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/manage-dashboards"
[Manage dashboards]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/manage-dashboards"

[Build dashboards]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/build-dashboards"
[Build dashboards]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/build-dashboards"

[Use dashboards]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/use-dashboards"
[Use dashboards]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/use-dashboards"

[Playlist]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/create-manage-playlists"
[Playlist]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/dashboards/create-manage-playlists"
{{% /docs/reference %}}
