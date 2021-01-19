+++
title = "Export logs of usage insights"
description = "Export logs of usage insights"
keywords = ["grafana", "export", "usage-insights", "enterprise"]
aliases = ["/docs/grafana/latest/enterprise/usage-insights/export-logs.md"]
weight = 500
+++

# Export logs of usage insights

> **Note:** Available in Grafana Enterprise v7.4+.

By exporting usage logs to Loki, you can directly query them and create dashboards of the information that matters to you most, such as dashboard errors, most active organizations, or your top-10 most-used queries. Currently, usage logs can only be exported to Loki.

## Usage insights logs

Usage insights logs are JSON objects that represent various user activity:
- A user opens a dashboard.
- A query is sent to a data source.

### Scope

A log is created every time a user opens a dashboard or when a query is sent to a data source in the dashboard view. A query that is made through Explore does not generate a log.

### Format
Logs of usage insights contain the following fields, where the fields followed by * are always available, and the others depend on the logged event:
| Field name | Type | Description |
| ---------- | ---- | ----------- |
| `eventName`\* | string | Type of the event, which can be either `data-request` or `dashboard-view`. |
| `folderName`\* | string | Name of the dashboard folder. |
| `dashboardName`\* | string | Name of the dashboard where the event happened. |
| `dashboardId`\* | number | ID of the dashboard where the event happened. |
| `datasourceName`| string | Name of the data source that was queried. |
| `datasourceType` | string | Type of the data source that was queried. For example, `prometheus`, `elasticsearch`, or `loki`. |
| `datasourceId` | number | ID of the data source that was queried. |
| `panelId` | number | ID of the panel of the query. |
| `panelName` | string | Name of the panel of the query. |
| `error` | string | Error returned by the query. |
| `duration` | number | Duration of the query. |
| `orgId`\* | number | ID of the user’s organization. |
| `orgName`\* | string | Name of the user’s organization. |
| `timestamp`\* | string | The date and time that the request was made, in Coordinated Universal Time (UTC) in [RFC3339](https://tools.ietf.org/html/rfc3339#section-5.6) format. |
| `sessionId`\* | number | ID of the user’s session. |
| `username`\* | string | Name of the Grafana user that made the request. |
| `userId`\* | number | ID of the Grafana user that made the request. |

## Configuration

The following procedure assumes that you have installed Loki. Refer to [Install Loki](/docs/loki/latest/installation/).

To export your logs, enable the usage insights feature and [configure]({{< relref "../../administration/configuration.md" >}}) an export location in the configuration file:

```ini
[usage_insights.export]
# Enable the usage insights export feature
enabled = true
# Storage type
storage = loki

[usage_insights.export.storage.loki]
# Set the communication protocol to use with Loki (can be grpc or http)
type = grpc
# Set the address for writing logs to Loki (format must be host:port)
url = localhost:9095
# Defaults to true. If true, it establishes a secure connection to Loki
tls = true
```

## Visualize Loki usage insights in Grafana

Now that your logs are exported into Loki, you can build Grafana dashboards to understand your Grafana instance usage.
1. Add Loki as a data source. Refer to [Grafana fundamentals tutorial](/tutorials/grafana-fundamentals/#6).
1. Import one of the following dashboards:
    * <TODO> Link
    * <TODO> Link
1. Play with usage insights to understand them:
    * <TODO> Example log-style query using labels
    * <TODO> Example metric-style query using labels






