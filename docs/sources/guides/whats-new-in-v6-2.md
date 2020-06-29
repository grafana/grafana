+++
title = "What's new in Grafana v6.2"
description = "Feature and improvement highlights for Grafana v6.2"
keywords = ["grafana", "new", "documentation", "6.2", "release notes"]
type = "docs"
[menu.docs]
name = "Version 6.2"
identifier = "v6.2"
parent = "whatsnew"
weight = -13
+++

# What's new in Grafana v6.2

For all details please read the full [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

If you use a password for your data sources please read the [upgrade notes](/installation/upgrading/#upgrading-to-v6-2).

Check out the [demo dashboard](https://play.grafana.org/d/ZvPm55mWk/new-features-in-v6-2?orgId=1) of some the new features in v6.2.

## Improved security

Data sources now store passwords and basic auth passwords in `secureJsonData` encrypted by default. Existing data source with unencrypted passwords will keep working.
Read the [upgrade notes](/installation/upgrading/#upgrading-to-v6-2) on how to migrate existing data sources to use encrypted storage.

To mitigate the risk of [Clickjacking](https://www.owasp.org/index.php/Clickjacking), embedding Grafana is no longer allowed per default.
Read the [upgrade notes](/installation/upgrading/#upgrading-to-v6-2) for further details of how this may affect you.

To mitigate the risk of sensitive information being cached in browser after a user has logged out, browser caching is now disabled for full page requests.

## Provisioning

- Environment variables support, see [Using environment variables](/administration/provisioning/#using-environment-variables) for more information.
- Reload provisioning configs, see [Admin HTTP API](/http_api/admin/#reload-provisioning-configurations) for more information.
- Do not allow deletion of provisioned dashboards
- When trying to delete or save provisioned dashboard, relative file path to the file is shown in the dialog.

## Official support for Elasticsearch 7

Grafana v6.2 ships with official support for Elasticsearch v7, see [Using Elasticsearch in Grafana](/features/datasources/elasticsearch/#elasticsearch-version) for more information.

## Bar Gauge Panel

Grafana v6.2 ships with a new exciting panel! This new panel, named Bar Gauge, is very similar to the current
Gauge panel and shares almost all it's options. The main difference is that the Bar Gauge uses both horizontal and
vertical space much better and can be more efficiently stacked both vertically and horizontally. The Bar Gauge also
comes with 3 unique display modes, Basic, Gradient, and Retro LED. Read the
[preview article](https://grafana.com/blog/2019/04/11/sneak-preview-of-new-visualizations-coming-to-grafana/) to learn
more about the design and features of this new panel.

Retro LED display mode
{{< docs-imagebox img="/assets/img/blog/bargauge/bar_gauge_retro_led.jpg" max-width="800px" caption="Bar Gauge LED mode" >}}

Gradient mode
{{< docs-imagebox img="/assets/img/blog/bargauge/gradient.jpg" max-width="800px" caption="Bar Gauge Gradient mode" >}}

## Improved table data support

We have been working on improving table support in our new react panels (Gauge and Bar Gauge) and this is ongoing work
that will eventually come to the new Graph and Singlestat and Table panels we are working on. But you can see it already in
the Gauge and Bar Gauge panels. Without any config, you can visualize any number of columns or choose to visualize each
row as its own gauge.

## Lazy loading of panels out of view

This has been one of the most requested features for many years and is now finally here! Lazy loading of panels means
Grafana will not issue any data queries for panels that are not visible. This will greatly reduce the load
on your data source backends when loading dashboards with many panels.

## Panels without title

Sometimes your panels do not need a title and having that panel header still take up space makes singlestats and
other panels look strange and have bad vertical centering. In v6.2 Grafana will allow panel content (visualizations)
to use the full panel height in case there is no panel title.

{{< docs-imagebox img="/img/docs/v62/panels_with_no_title.jpg" max-width="800px" caption="Bar Gauge Gradient mode" >}}

## Minor Features and Fixes

This release contains a lot of small features and fixes:

- Explore - Adds user time zone support, reconnect for failing data sources and a fix that prevents killing Prometheus instances when Histogram metrics are loaded.
- Alerting - Adds support for configuring timeout durations and retries, see [configuration](/administration/configuration/#evaluation-timeout-seconds) for more information.
- Azure Monitor - Adds support for multiple subscriptions per data source.
- Elasticsearch - A small bug fix to properly display percentiles metrics in table panel.
- InfluxDB - Support for POST HTTP verb.
- CloudWatch - Important fix for default alias disappearing in v6.1.
- Search - Works in a scope of dashboard's folder by default when viewing dashboard.

Check out the [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) file for a complete list of new features, changes, and bug fixes.

A huge thanks to our community for all the reported issues, bug fixes and feedback.

## Upgrading

Read important [upgrade notes](/installation/upgrading/#upgrading-to-v6-2).
