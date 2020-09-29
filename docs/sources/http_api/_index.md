+++
title = "HTTP API"
description = "Grafana HTTP API"
keywords = ["grafana", "http", "documentation", "api", "overview"]
aliases = ["/docs/grafana/latest/overview"]
type = "docs"
[menu.docs]
name = "HTTP API"
identifier = "http_api"
weight = 9
+++


# HTTP API Reference

The Grafana backend exposes an HTTP API, the same API is used by the frontend to do everything from saving
dashboards, creating users and updating data sources.

## Supported HTTP APIs


- [Authentication API]({{< relref "auth.md" >}})
- [Dashboard API]({{< relref "dashboard.md" >}})
- [Dashboard Versions API]({{< relref "dashboard_versions.md" >}})
- [Dashboard Permissions API]({{< relref "dashboard_permissions.md" >}})
- [Folder API]({{< relref "folder.md" >}})
- [Folder Permissions API]({{< relref "folder_permissions.md" >}})
- [Folder/dashboard search API]({{< relref "folder_dashboard_search.md" >}})
- [Data Source API]({{< relref "data_source.md" >}})
- [Organization API]({{< relref "org.md" >}})
- [Snapshot API]({{< relref "snapshot.md" >}})
- [Annotations API]({{< relref "annotations.md" >}})
- [Playlists API]({{< relref "playlist.md" >}})
- [Alerting API]({{< relref "alerting.md" >}})
- [Alert Notification Channels API]({{< relref "alerting_notification_channels.md" >}})
- [User API]({{< relref "user.md" >}})
- [Team API]({{< relref "team.md" >}})
- [Admin API]({{< relref "admin.md" >}})
- [Preferences API]({{< relref "preferences.md" >}})
- [Other API]({{< relref "other.md" >}})

### Grafana Enterprise HTTP APIs

- [Data Source Permissions API]({{< relref "datasource_permissions.md" >}})
- [External Group Sync API]({{< relref "external_group_sync.md" >}})
- [Reporting API]({{< relref "reporting.md" >}})
