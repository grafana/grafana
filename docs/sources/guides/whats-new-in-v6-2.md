+++
title = "What's New in Grafana v6.2"
description = "Feature & improvement highlights for Grafana v6.2"
keywords = ["grafana", "new", "documentation", "6.2"]
type = "docs"
[menu.docs]
name = "Version 6.2"
identifier = "v6.2"
parent = "whatsnew"
weight = -13
+++

# What's New in Grafana v6.2

## Highlights

### Improved security

- Ensure encryption of datasource secrets
- Embedding Grafana not allowed per default

### Lazy load out of view panels



### Provisioning

- Environment variables support, see [Using environment variables](/administration/provisioning/#using-environment-variables) for more information.
- Reload provisioning configs, see [Admin HTTP API](/http_api/admin/#reload-provisioning-configurations) for more information.
- Do not allow deletion of provisioned dashboards

### Official support for Elasticsearch 7

Grafana v6.2 ships with official support for Elasticsearch v7, see [Using Elasticsearch in Grafana](/features/datasources/elasticsearch/#elasticsearch-version) for more information.

### Minor Features and Fixes

This release contains a lot of small features and fixes:

- Panels: No title will no longer make panel header take up space
- Explore - Adds user time zone support, reconnect for failing datasources and a fix that prevents killing Prometheus instances when Histogram metrics are loaded.
- Alerting - Adds support for configuring timeout durations and retries, see [configuration](/installation/configuration/#evaluation-timeout-seconds) for more information.
- Elasticsearch - A small bug fix to properly display percentiles metrics in table panel.
- InfluxDB - Support for POST HTTP verb.
- CloudWatch - Important fix for default alias disappearing in v6.1.

Checkout the [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) file for a complete list of new features, changes, and bug fixes.

A huge thanks to our community for all the reported issues, bug fixes and feedback.

## Upgrading

Read important [upgrade notes](/installation/upgrading/#upgrading-to-v6-2).
