+++
title = "What's New with Unified Alerts"
description = "What's New with Unified Alerts"
keywords = ["grafana", "alerting", "guide"]
weight = 112
+++

# Differences between Unified Alerts and Grafana dashboard alerts
The Unified Alerts released with Grafana 8.0 as an opt-in feature centralizes alerting information for Grafana managed alerts and alerts from Prometheus-compatible datasources in one UI and API. You are able to create and edit alerting rules for Grafana managed alerts and see alerting information from Prometheus-compatible datasources in a single, searchable view.

## Create alerts outside of Dashboards
Grafana dashboard alerts were exactly that: alerts that were tied to a dashboard. Unified Alerts allows you to create queries and expressions that can combine data from multiple sources, in unique ways. You are still able to link dashboards and panels to alerts, allowing you to quickly troubleshoot the system under observation, by linking a dashboard and/or panel ID to the alerting rule. 

## View and search for alerts from Prometheus
You can now display all of your alerting information in one, searchable UI. Alerts for Prometheus compatible datasources are listed below Grafana managed alerts. Search for labels across multiple datasources to quickly find all of the relevant alerts.
