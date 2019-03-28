+++
title = "What's New in Grafana v6.1"
description = "Feature & improvement highlights for Grafana v6.1"
keywords = ["grafana", "new", "documentation", "6.1"]
type = "docs"
[menu.docs]
name = "Version 6.1"
identifier = "v6.1"
parent = "whatsnew"
weight = -12
+++

# What's New in Grafana v6.1

## Highlights

### Ad hoc Filtering for Prometheus

{{< imgbox max-width="30%" img="/img/docs/v61/prometheus-ad-hoc.gif" caption="Ad-hoc filters variable for Prometheus" >}}

The ad hoc filter feature allows you to create new key/value filters on the fly with autocomplete for both key and values. The filter condition is then automatically applied to all queries on the dashboard. This makes it easier to explore your data in a dashboard without changing queries and without having to add new template variables.

Other timeseries databases with label-based query languages have had this feature for a while. Recently Prometheus added support for fetching label names from their API and thanks to [Mitsuhiro Tanda](https://github.com/mtanda) implementing it in Grafana, the Prometheus datasource finally supports ad hoc filtering.

Support for fetching a list of label names was released in Prometheus v2.6.0 so that is a requirement for this feature to work in Grafana.

### Permissions: Editors can own dashboards, folders and teams they create

When the dashboard folders feature and permissions system was released in Grafana 5.0, users with the editor role were not allowed to administrate dashboards, folders or teams. In the 6.1 release, we have added a config option so that by default editors are admins for any Dashboard, Folder or Team they create.

This feature also adds a new Team permission that can be assigned to any user with the editor or viewer role and lets that user add other users to the Team.

We believe that this is more in line with the Grafana philosophy, as it will allow teams to be more self-organizing. This option will be made permanent if it gets positive feedback from the community so let us know what you think in the [issue on GitHub](https://github.com/grafana/grafana/issues/15590).

To turn this feature on add the following [config option](/installation/configuration/#editors-can-admin) to your Grafana ini file in the `users` section and then restart the Grafana server:

```ini
[users]
editors_can_admin = true
```

### Minor Features and Fixes

This release contains a lot of small features and fixes:

- A new keyboard shortcut `d l` toggles all Graph legends in a dashboard.
- A small bug fix for Elasticsearch - template variables in the alias field now work properly.
- Some new capabilities have been added for datasource plugins that will be of interest to plugin authors:
  - a new oauth pass-through option.
  - it is now possible to add user details to requests sent to the dataproxy.
- Heatmap and Explore fixes.

Checkout the [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) file for a complete list of new features, changes, and bug fixes.

A huge thanks to our community for all the reported issues, bug fixes and feedback.
