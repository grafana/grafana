+++
title = "What's new in Grafana v8.0"
description = "Feature and improvement highlights for Grafana v8.0"
keywords = ["grafana", "new", "documentation", "8.0", "release notes"]
weight = -33
aliases = ["/docs/grafana/latest/guides/whats-new-in-v8-0/"]
[_build]
list = false
+++

# What’s new in Grafana v8.0

> **Note:** This topic will be updated frequently between now and the final release.

This topic includes the release notes for Grafana v8.0. For all details, read the full [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

## Grafana OSS features

These features are included in the Grafana open source edition.

### Library panels

Library panels allow users to build panels that can be used in multiple dashboards. Any updates made to that shared panel will then automatically be applied to all the dashboards that have that panel.

### Timeline panel

Shows discrete status or state transitions of something over time. For example daily uptime or multi-sensor and digital I/O status.

### Bar chart panel

New visualization that allows categorical data display. Following the new panel architecture supports field config and overrides, common tooltip, and legend options.

### Time series panel updates

The Time series is out of beta!  We are removing the `Beta`tag and graduating the Time series panel to a stable state.
- **Time series** is now the default visualization option, replacing the **Graph (old)**.
- The Time series panel now supports stacking. For more information, refer to [Graph stacked time series]({{< relref "../panels/visualizations/time-series/graph-time-series-stacking.md" >}}).
- We added support for a shared crosshair and a tooltip that’s now smarter when it comes to data display in the tooltip.
- Various performance improvements.

### Panel editor updates

- All options are now shown in a single pane.
- You can now search panel options.
- Value mapping has been completely redesigned.

### Look and feel update

Grafana 8 comes with a refreshed look and feel, including themes changed to be more accessible. The improved Grafana UI brings a number of adjustments and tweaks that make the application even more fun to use. Under the hood, the new theme architecture enables us to bring more sophisticated themes control in the future.

### Download logs

When you inspect a panel, you can now download log results as a text (.txt) file.

[Download log results]({{< relref "../panels/inspect-panel.md#download-log-results" >}}) in [Inspect a panel]({{< relref "../panels/inspect-panel.md" >}}) was added as a result of this feature.

### Inspector in Explore

The new Explore inspector helps you understand and troubleshoot your queries. You can inspect the raw data, export that data to a comma-separated values (CSV) file, export log results in text format, and view query requests.

[Inspector in Explore]({{< relref "../explore/explore-inspector.md" >}}) was added as a result of this feature.

### Explore log improvements

Log navigation in Explore has been significantly improved. We added pagination to logs, so you can click through older or newer logs as needed.

[Logs in Explore]({{< relref "../explore/logs-integration.md" >}}) was updated as a result of these changes.

![Navigate logs in Explore](/img/docs/explore/navigate-logs-8-0.png)

### Tracing improvements

- Exemplars
- Better Jaeger search in Explore
- Show trace graph for Jaeger, Zipkin, and Tempo

### Plugin marketplace

You can now use the Plugin Marketplace app to easily manage your plugins from within Grafana. Install, update, and uninstall plugins without requiring a server restart.

## Enterprise features

These features are included in the Grafana Enterprise edition.

### Fine-grained access control

You can now add or remove detailed permissions from Viewer, Editor, and Admin org roles, to grant users just the right amount of access within Grafana. Available permissions include the ability to view and manage Users, Reports, and the Access Control API itself. Grafana will support more and more permissions over the coming months.

### Data source query caching

Grafana will now cache the results of backend data source queries, so that multiple users viewing the same dashboard or panel will not each submit the same query to the data source (like Splunk or Snowflake) itself. This results in faster average load times for dashboards and fewer duplicate queries overall to data sources, which reduces cost and the risk of throttling, reaching API limits, or overloading your data sources. Caching can be enabled per-data source, and time-to-live (TTL) can be configured globally and per data source. Query caching can be set up with Redis, Memcached, or a simple in-memory cache.

### Reporting updates

When creating a report, you can now choose to export Table Panels as .csv files attached to your report email. This will make it easier for recipients to view and work with that data. You can also link back to the dashboard directly from the email, for users who want to see the data live in Grafana. This release also includes some improvements to the Reports list view.

## Breaking changes

The following breaking changes are included in this release.

### Variables

- Removed the **Value groups/tags** feature from variables. Any tags will be removed.
- Removed the `never` refresh option for query variables. Existing variables will be migrated and any stored options will be removed.

Documentation was updated to reflect these changes.
