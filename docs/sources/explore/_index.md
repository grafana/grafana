+++
title = "Explore"
keywords = ["explore", "loki", "logs"]
aliases = ["/docs/grafana/latest/features/explore/"]
weight = 90
+++

# Explore

Grafana's dashboard UI is all about building dashboards for visualization. Explore strips away the dashboard and panel options so that you can focus on the query. It helps you iterate until you have a working query and can then think about building a dashboard.

> Refer to [Fine-grained access control]({{< relref "../enterprise/access-control/_index.md" >}}) in Grafana Enterprise to understand how you can control access with fine-grained permissions.

If you just want to explore your data and do not want to create a dashboard, then Explore makes this much easier. If your data source supports graph and table data, then Explore shows the results both as a graph and a table. This allows you to see trends in the data and more details at the same time. See also:

- [Query management in Explore]({{< relref "query-management.md" >}})
- [Logs integration in Explore]({{< relref "logs-integration.md" >}})
- [Trace integration in Explore]({{< relref "trace-integration.md" >}})
- [Inspector in Explore]({{< relref "explore-inspector.md" >}})

## Available feature toggles

### explore2Dashboard

> **Note:** Available in Grafana 8.5.0 and later versions.

Enabled by default, allows users to create panels in dashboards from within Explore.
