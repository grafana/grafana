+++
title = "What's New in Grafana v6.3"
description = "Feature & improvement highlights for Grafana v6.3"
keywords = ["grafana", "new", "documentation", "6.3"]
type = "docs"
[menu.docs]
name = "Version 6.3"
identifier = "v6.3"
parent = "whatsnew"
weight = -14
+++

# What's New in Grafana v6.3

For all details please read the full [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md)

The main highlights are:

- New Explore features
  - [Loki Live Streaming]({{< relref "#loki-live-streaming" >}})
  - [Loki Context Queries]({{< relref "#loki-context-queries" >}})
  - [Elasticsearch Logs Support]({{< relref "#elasticsearch-logs-support" >}})
  - [InfluxDB Logs Support]({{< relref "#influxdb-logs-support" >}})
- [New Time Picker]({{< relref "#new-time-picker" >}})
- [Graph Area Gradients]({{< relref "#graph-gradients" >}}) - A new graph display option!
- Grafana Enterprise
  - [LDAP Active Sync]({{< relref "#ldap-active-sync" >}}) - LDAP Active Sync
  - [SAML Authentication]({{< relref "#saml-authentication" >}}) - SAML Authentication

## Explore improvements

This release adds a ton of enhancements to Explore. Both in terms of new general enhancements but also in
new data source specific features.

### Loki live streaming

For log queries using the Loki data source you can now stream logs live directly to the Explore UI.

### Loki context queries

After finding a log line through the heavy use of query filters it can then be useful to
see the log lines surrounding the line your searched for. The `show context` feature
allows you to view lines before and after the line of interest.

### Elasticsearch logs support

This release adds support for searching & visualizing logs stored in Elasticsearch in the Explore mode. With a special
simplified query interface specifically designed for logs search.

### InfluxDB logs support

This release adds support for searching & visualizing logs stored in InfluxDB in the Explore mode. With a special
simplified query interface specifically designed for logs search.

### New Time Picker

The time picker has been re-designed and is now a bit quicker to use for the most common quick ranges.

{{< docs-imagebox img="/img/docs/v63/time_picker.png" max-width="400px" caption="New Time Picker" >}}

### Graph Gradients

Want more eye candy in your graphs? Then the fill gradient option might be for you! Works really well for
graphs with only a single series.

{{< docs-imagebox img="/img/docs/v63/graph_gradient_area.jpeg" max-width="800px" caption="Graph Gradient Area" >}}

Looks really nice in light theme as well.

{{< docs-imagebox img="/img/docs/v63/graph_gradients_white.png" max-width="800px" caption="Graph Gradient Area" >}}

### LDAP Active Sync

This is a new Enterprise feature that enables background syncing of user information, org role and teams memberships.
This syncing is otherwise only done at login time. With this feature you can schedule a sync job that
performs active syncing. For example a user removed from an LDAP group would be automatically removed from a corresponding
team in Grafanam or if no longer belong to an LDAP group that gives them access to Grafana they would be immediatel
logged out.

[Read more](../auth/enhanced_ldap/#active-ldap-synchronization)
