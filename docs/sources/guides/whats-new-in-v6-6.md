
+++
title = "What's New in Grafana v6.6"
description = "Feature and improvement highlights for Grafana v6.6"
keywords = ["grafana", "new", "documentation", "6.6"]
type = "docs"
[menu.docs]
name = "Version 6.6"
identifier = "v6.6"
parent = "whatsnew"
weight = -16
+++

# What's New in Grafana v6.6

For all details, read the full [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md)

## Highlights

Grafana 6.6 comes with a lot of new features and enhancements:

- **Panels:** New Stat panel
- **Panels:** New News panel
- **New time picker**
- **User-configurable units**
- [**Alerting enhancements**]({{< relref "#alerting-enhancements" >}})
- **Explore:** Added log message line wrapping options for logs
- **Graphite:** Added Metrictank dashboard to Graphite datasource
- **Loki:** Support for template variable queries
- **Postgres/MySQL/MSSQL:** Added support for region annotations
- **Explore:** Added ability to specify step with Prometheus queries
- [**Security:** Added disabled option for cookie samesite attribute]({{< relref "#cookie-management-modifications" >}})
- **TablePanel, GraphPanel:** Exclude hidden columns from CSV

More details will be added as we're getting closer to the stable release.

## Alerting enhancements

 - We have introduced a new configuration for enforcing a minimal interval between evaluations, to reduce load on the backend. 
 - The email notifier can now optionally send a single email to all recipients. 
 - OpsGenie, PagerDuty, Threema, and Google Chat notifiers have been updated to send additional information.

## Cookie management modifications

In order to align with a [change in Chrome 80](https://www.chromestatus.com/feature/5088147346030592), a breaking change has been introduced. The `[security]` setting `cookie_samesite` configured to `none` now renders cookies with `SameSite=None` attribute contrary to the previous behavior where no `SameSite` attribute was added to cookies. To get back the old behavior, you must set `cookie_samesite` to `disabled`.