+++
title = "What's new in Grafana v6.3"
description = "Feature and improvement highlights for Grafana v6.3"
keywords = ["grafana", "new", "documentation", "6.3", "release notes"]
type = "docs"
[menu.docs]
name = "Version 6.3"
identifier = "v6.3"
parent = "whatsnew"
weight = -14
+++

# What's new in Grafana v6.3

For all details please read the full [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

## Highlights

- New Explore features
  - [Loki Live Streaming]({{< relref "#loki-live-streaming" >}})
  - [Loki Context Queries]({{< relref "#loki-context-queries" >}})
  - [Elasticsearch Logs Support]({{< relref "#elasticsearch-logs-support" >}})
  - [InfluxDB Logs Support]({{< relref "#influxdb-logs-support" >}})
- [Data links]({{< relref "#data-links" >}})
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

This release adds support for searching and visualizing logs stored in Elasticsearch in the Explore mode. With a special
simplified query interface specifically designed for logs search.

{{< docs-imagebox img="/img/docs/v63/elasticsearch_explore_logs.png" max-width="600px" caption="New Time Picker" >}}

Please read [Using Elasticsearch in Grafana](/features/datasources/elasticsearch/#querying-logs-beta) for more detailed information on how to get started and use it.

### InfluxDB logs support

This release adds support for searching and visualizing logs stored in InfluxDB in the Explore mode. With a special
simplified query interface specifically designed for logs search.

{{< docs-imagebox img="/img/docs/v63/influxdb_explore_logs.png" max-width="600px" caption="New Time Picker" >}}

Please read [Using InfluxDB in Grafana](/features/datasources/influxdb/#querying-logs-beta) for more detailed information on how to get started and use it.

## Data Links

We have simplified the UI for defining panel drilldown links (and renamed them to Panel links). We have also added a
new type of link named `Data link`. The reason to have two different types is to make it clear how they are used
and what variables you can use in the link. Panel links are only shown in the top left corner of
the panel and you cannot reference series name or any data field.

While `Data links` are used by the actual visualization and can reference data fields.

Example:
```url
http://my-grafana.com/d/bPCI6VSZz/other-dashboard?var-server=${__series_name}
```

You have access to these variables:

Name | Description
------------ | -------------
*${__series_name}* | The name of the time series (or table)
*${__value_time}* | The time of the point your clicking on (in millisecond epoch)
*${__url_time_range}* | Interpolates as the full time range (i.e. from=21312323412&to=21312312312)
*${__all_variables}* | Adds all current variables (and current values) to the url

You can then click on point in the Graph.

{{< docs-imagebox img="/img/docs/v63/graph_datalink.png" max-width="400px" caption="New Time Picker" >}}

For now only the Graph panel supports `Data links` but we hope to add these to many visualizations.

## New Time Picker

The time picker has been re-designed and with a more basic design that makes accessing quick ranges more easy.

{{< docs-imagebox img="/img/docs/v63/time_picker.png" max-width="400px" caption="New Time Picker" >}}

## Graph Gradients

Want more eye candy in your graphs? Then the fill gradient option might be for you! Works really well for
graphs with only a single series.

{{< docs-imagebox img="/img/docs/v63/graph_gradient_area.jpeg" max-width="800px" caption="Graph Gradient Area" >}}

Looks really nice in light theme as well.

{{< docs-imagebox img="/img/docs/v63/graph_gradients_white.png" max-width="800px" caption="Graph Gradient Area" >}}

## Grafana Enterprise

Substantial refactoring and improvements to the external auth systems has gone in to this release making the  features
listed below possible as well as laying a foundation for future enhancements.

### LDAP Active Sync

This is a new Enterprise feature that enables background syncing of user information, org role and teams memberships.
This syncing is otherwise only done at login time. With this feature you can schedule how often this user synchronization should
occur.

For example, lets say a user is removed from an LDAP group. In previous versions of Grafana an admin would have to
wait for the user to logout or the session to expire for the Grafana permissions to update, a process that can take days.

With active sync the user would be automatically removed from the corresponding team in Grafana or even logged out and disabled if no longer
belonging to an LDAP group that gives them access to Grafana.

[Read more](/auth/enhanced_ldap/#active-ldap-synchronization).

### SAML Authentication

Built-in support for SAML is now available in Grafana Enterprise.

[See docs]({{< relref "../auth/saml.md" >}})

### Team Sync for GitHub OAuth

When setting up OAuth with GitHub it's now possible to sync GitHub teams with Teams in Grafana.

[See docs]({{< relref "../auth/github.md" >}})

### Team Sync for Auth Proxy

We've added support for enriching the Auth Proxy headers with Teams information, which makes it possible
to use Team Sync with Auth Proxy.

[See docs](/auth/auth-proxy/#auth-proxy-authentication).
