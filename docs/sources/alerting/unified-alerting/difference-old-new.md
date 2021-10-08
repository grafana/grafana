+++
title = "What's New with Grafana 8 alerts"
description = "What's New with Grafana 8 Alerts"
keywords = ["grafana", "alerting", "guide"]
weight = 114
+++

# What's new in Grafana 8 alerting

Grafana 8.0 alerts centralize alerting information for Grafana managed alerts and alerts from Prometheus-compatible data sources in one UI and API. You can create and edit alerting rules for Grafana managed alerts, Cortex alerts, and Loki alerts, as well as see alerting information from Prometheus-compatible data sources in a single, searchable view.

## Multi-dimensional alerting

You can now create alerts that give you system-wide visibility with a single alerting rule. Generate multiple alert instances from a single alert rule. For example, you can create a rule to monitor the disk usage of multiple mount points on a single host. The evaluation engine returns multiple time series from a single query, with each time series identified by its label set.

## Create alerts outside of Dashboards

Unlike legacy dashboard alerts, Grafana 8 Alerts allow you to create queries and expressions that combine data from multiple sources in unique ways. You can still link dashboards and panels to alerting rules using their ID and quickly troubleshoot the system under observation.

## Create Loki and Cortex alerting rules

In Grafana 8 alerting, you can manage Loki and Cortex alerting rules using the same UI and API as your Grafana managed alerts.

## View and search for alerts from Prometheus compatible data sources

Alerts for Prometheus compatible data sources are now listed under the Grafana alerts section. You can search for labels across multiple data sources to quickly find relevant alerts.