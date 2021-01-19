+++
title = "Usage insights"
description = "Understand how your Grafana instance is used"
keywords = ["grafana", "usage-insights", "enterprise"]
aliases = ["/docs/grafana/latest/enterprise/usage-insights/"]
weight = 100
+++

# Usage insights

Usage insights allow you to have a better understanding of how your Grafana instance is used. 

The usage insights feature collects aggregated data and stores them in the database. It counts the number of:
- Dashboard views (aggregated and per user)
- Data source errors
- Data source queries

These aggregated data give you access to:
- [Dashboard and data source insights]({{< relref "dashboard-datasource-insights.md" >}})
- [Presence indicator]({{< relref "presence-indicator.md" >}})
- [Improved dashboard search]({{< relref "improved-search.md" >}})

This feature also generates detailed logs that can be [exported to Loki]({{< relref "export-logs.md" >}}).
