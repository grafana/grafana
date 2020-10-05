+++
title = "What's new in Grafana v5.4"
description = "Feature and improvement highlights for Grafana v5.4"
keywords = ["grafana", "new", "documentation", "5.4", "release notes"]
type = "docs"
[menu.docs]
name = "Version 5.4"
identifier = "v5.4"
parent = "whatsnew"
weight = -10
+++

# What's new in Grafana v5.4

Grafana v5.4 brings new features, many enhancements and bug fixes. This article will detail the major new features and enhancements.

- [Alerting]({{< relref "#alerting" >}}) Limit false positives with the new `For` setting
- [Google Stackdriver]({{< relref "#google-stackdriver" >}}) Now with support for templating queries
- [MySQL]({{< relref "#mysql-query-builder" >}}) gets a new query builder!
- [Graph Panel]({{< relref "#graph-panel-enhancements" >}}) Highlight time regions and more
- [Team Preferences]({{< relref "#team-preferences" >}}) Give your teams their own home dashboard

## Alerting

{{< docs-imagebox img="/img/docs/v54/alerting-for-dark-theme.png" max-width="600px" class="docs-image--right" >}}

Grafana v5.4 ships with a new alert rule setting named `For` which is great for removing false positives. If an alert rule has a configured `For` and the query violates the configured threshold it will first go from `OK` to `Pending`. Going from `OK` to `Pending` Grafana will not send any notifications. Once the alert rule has been firing for more than `For` duration, it will change to `Alerting` and send alert notifications. Typically, it's always a good idea to use this setting since it's often worse to get false positive than wait a few minutes before the alert notification triggers.

In the screenshot you can see an example timeline of an alert using the `For` setting. At ~16:04 the alert state changes to `Pending` and after 4 minutes it changes to `Alerting` which is when alert notifications are sent. Once the series falls back to normal the alert rule goes back to `OK`. [Learn more](/alerting/alerts-overview/#for).

Additionally, there's now support for disable the sending of `OK` alert notifications. [Learn more](/alerting/notifications/#disable-resolve-message).

<div class="clearfix"></div>

## Google Stackdriver

{{< docs-imagebox img="/img/docs/v54/stackdriver_template_query.png" max-width="600px" class="docs-image--right" >}}

Grafana v5.3 included built-in support for [Google Stackdriver](https://cloud.google.com/stackdriver/) which enables you to visualize your Stackdriver metrics in Grafana.
One important feature missing was support for templating queries. This is now included together with a brand new templating query editor for Stackdriver.

The Stackdriver templating query editor lets you choose from a set of different Query Types. This will in turn reveal additional drop downs to help you
find, filter and select the templating values you're interested in, see screenshot for details. The templating query editor also supports chaining multiple variables
making it easy to define variables that's dependent on other variables.

Stackdriver is the first data source which has support for a custom templating query editor. But starting from Grafana v5.4 it's now possible for all data sources, including plugin data sources, to
create their very own templating query editor.

Additionally, if Grafana is running on a Google Compute Engine (GCE) virtual machine, it is now possible for Grafana to automatically retrieve default credentials from the metadata server.
This has the advantage of not needing to generate a private key file for the service account and also not having to upload the file to Grafana. [Learn more]({{< relref "../features/datasources/cloudmonitoring/#using-gce-default-service-account" >}}).

Please read [Using Google Stackdriver in Grafana]({{< relref "../features/datasources/cloudmonitoring/" >}}) for more detailed information on how to get started and use it.

<div class="clearfix"></div>

## MySQL Query Builder

Grafana v5.4 comes with a new graphical query builder for MySQL. This brings MySQL integration more in line with some of the other data sources and makes it easier for both advanced users and beginners to work with timeseries in MySQL. Learn more about it in the [documentation]({{< relref "../features/datasources/mysql/#query-editor" >}}).

{{< docs-imagebox img="/img/docs/v54/mysql_query_still.png" animated-gif="/img/docs/v54/mysql_query.gif" >}}

## Graph Panel Enhancements

Grafana v5.4 adds support for highlighting weekdays and/or certain timespans in the graph panel. This should make it easier to compare for example weekends, business hours and/or off work hours.

{{< docs-imagebox img="/img/docs/v54/graph_time_regions.png" max-width= "800px" >}}

Additionally, when rendering series as lines in the graph panel, should there be only one data point available for one series so that a connecting line cannot be established, a point will
automatically be rendered for that data point. This should make it easier to understand what's going on when only receiving a single data point.

{{< docs-imagebox img="/img/docs/v54/graph_dot_single_point.png" max-width= "800px" >}}

## Team Preferences

Grafana v5.4 adds support for customizing home dashboard, timezone and theme for teams, in addition to the existing customization on Organization and user Profile level.

1. Specifying a preference on User Profile level will override preference on Team and/or Organization level
1. Specifying a preference on Team level will override preference on Organization level.

## Changelog

Check out the [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) file for a complete list
of new features, changes, and bug fixes.
