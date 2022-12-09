---
aliases:
  - unified-alerting/difference-old-new/
description: What's New with Grafana alerts
draft: true
keywords:
  - grafana
  - alerting
  - guide
title: What's new in Grafana Alerting
weight: 108
---

# What's new in Grafana Alerting

Grafana Alerting has several enhancements over legacy dashboard alerting.

## Multi-dimensional alerting

You can now create alerts that give you system-wide visibility with a single alerting rule. Generate multiple alert instances from a single alert rule. For example, you can create a rule to monitor the disk usage of multiple mount points on a single host. The evaluation engine returns multiple time series from a single query, with each time series identified by its label set.

## Create alerts outside of Dashboards

Unlike legacy dashboard alerts, Grafana alerts allow you to create queries and expressions that combine data from multiple sources in unique ways. You can still link dashboards and panels to alerting rules using their ID and quickly troubleshoot the system under observation.

Since unified alerts are no longer directly tied to panel queries, they do not include images or query values in the notification email. You can use customized notification templates to view query values.

## Create Loki and Grafana Mimir alerting rules

In Grafana Alerting, you can manage Loki and Grafana Mimir alerting rules using the same UI and API as your Grafana managed alerts.

## View and search for alerts from Prometheus compatible data sources

Alerts for Prometheus compatible data sources are now listed under the Grafana alerts section. You can search for labels across multiple data sources to quickly find relevant alerts.

## Special alerts for alert state NoData and Error

Grafana Alerting introduced a new concept of the alert states. When evaluation of an alerting rule produces state NoData or Error, Grafana Alerting will generate special alerts that will have the following labels:

- `alertname` with value DatasourceNoData or DatasourceError depending on the state.
- `rulename` name of the alert rule the special alert belongs to.
- `datasource_uid` will have the UID of the data source that caused the state.
- all labels and annotations of the original alert rule

You can handle these alerts the same way as regular alerts by adding a silence, route to a contact point, and so on.

> **Note:** If the rule uses many data sources and one or many returns no data, the special alert will be created for each data source that caused the alert state.
