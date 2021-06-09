+++
title = "What's New with Grafana 8 Alerts"
description = "What's New with Grafana 8 Alerts"
keywords = ["grafana", "alerting", "guide"]
weight = 112
+++

# What's New with Grafana 8 Alerts
The Alerts released with Grafana 8.0 are an opt-in feature that centralizes alerting information for Grafana managed alerts and alerts from Prometheus-compatible datasources in one UI and API. You are able to create and edit alerting rules for Grafana managed alerts, Cortex alerts, and Loki alerts as well as see alerting information from prometheus-compatible datasources in a single, searchable view.

## Multi-dimensional alerting
Create alerts that will give you system-wide visibility with a single alerting rule. With Grafana 8 alerts, you are able to generate multiple alert instances from a single rule eg. creating a rule to monitor disk usage for multiple mount points on a single host. The evaluation engine is able to return multiple time series from a single query. Each time series is identified by its label set. 

## Create alerts outside of Dashboards
Grafana legacy alerts were tied to a dashboard. Grafana 8 Alerts allow you to create queries and expressions that can combine data from multiple sources, in unique ways. You are still able to link dashboards and panels to alerting rules, allowing you to quickly troubleshoot the system under observation, by linking a dashboard and/or panel ID to the alerting rule. 

## Create Loki and Cortex alerting rules
With Grafana 8 Alerts you are able to manage your Loki and Cortex alerting rules using the same UI and API as your Grafana managed alerts. 

## View and search for alerts from Prometheus
You can now display all of your alerting information in one, searchable UI. Alerts for Prometheus compatible datasources are listed below Grafana managed alerts. Search for labels across multiple datasources to quickly find all of the relevant alerts.
