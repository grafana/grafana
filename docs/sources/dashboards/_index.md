---
aliases:
  - features/dashboard/dashboards/
cascade:
  labels:
    products:
      - cloud
      - enterprise
      - oss
title: Dashboards
weight: 70
---

# Dashboards

A dashboard is a set of one or more [panels]({{< relref "../panels-visualizations/" >}}) organized and arranged into one or more rows. Grafana ships with a variety of panels making it easy to construct the right queries, and customize the visualization so that you can create the perfect dashboard for your need. Each panel can interact with data from any configured Grafana [data source]({{< relref "../administration/data-source-management/" >}}).

Dashboard snapshots are static. Queries and expressions cannot be re-executed from snapshots. As a result, if you update any variables in your query or expression, it will not change your dashboard data.

Before you begin, ensure that you have configured a data source. See also:

- [Use dashboards]({{< relref "use-dashboards/" >}})
- [Build dashboards]({{< relref "./build-dashboards" >}})
- [Create dashboard folders]({{< relref "./manage-dashboards/#create-a-dashboard-folder" >}})
- [Manage dashboards]({{< relref "./manage-dashboards" >}})
- [Public dashboards]({{< relref "dashboard-public/" >}})
- [Annotations]({{< relref "./build-dashboards/annotate-visualizations" >}})
- [Playlist]({{< relref "./create-manage-playlists/" >}})
- [Reporting]({{< relref "./create-reports" >}})
- [Version history]({{< relref "./build-dashboards/manage-version-history" >}})
- [Export and import]({{< relref "./manage-dashboards/#export-and-import-dashboards" >}})
- [JSON model]({{< relref "./build-dashboards/view-dashboard-json-model/" >}})
