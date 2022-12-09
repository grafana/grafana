---
description: Understand how your Grafana instance is used
keywords:
  - grafana
  - usage-insights
  - enterprise
title: Usage insights
weight: 200
---

# Usage insights

Usage insights allow you to have a better understanding of how your Grafana instance is used.

> **Note:** Available in [Grafana Enterprise]({{< relref "../" >}}) and [Grafana Cloud Pro and Advanced]({{< ref "/docs/grafana-cloud" >}}).

The usage insights feature collects a number of aggregated data and stores them in the database:

- Dashboard views (aggregated and per user)
- Data source errors
- Data source queries

These aggregated data give you access to several features:

- [Dashboard and data source insights]({{< relref "dashboard-datasource-insights/" >}})
- [Presence indicator]({{< relref "presence-indicator/" >}})
- [Sort dashboards by using insights data]({{< relref "improved-search/" >}})

This feature also generates detailed logs that can be exported to Loki. Refer to [Export logs of usage insights]({{< relref "../../setup-grafana/configure-security/export-logs/" >}}).
