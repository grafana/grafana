---
description: Learn about the different alert rule types
keywords:
  - grafana
  - alerting
  - rule types
title: Alert rule types
weight: 102
---

# Alert rule types

Grafana supports several different alert rule types. Learn more about each of the alert rule types, how they work, and decide which one is best for your use case.

## Grafana-managed alert rules

Grafana-managed alert rules are the most flexible alert rule type. They allow you to create alerts that can act on data from any of our supported data sources.

In addition to supporting multiple data sources, you can also add expressions to transform your data and set alert conditions. Using images in alert notifications is also supported. This is the only type of rule that allows alerting from multiple data sources in a single rule definition.

## Grafana Mimir or Loki-managed alert rules

To create Grafana Mimir or Grafana Loki-managed alert rules, you must have a compatible Prometheus or Loki data source.

You can check if your data source supports rule creation via Grafana by testing the data source and observing if the ruler API is supported.

## Recording rules

Recording rules are only available for compatible Prometheus or Loki data sources.

A recording rule allows you to pre-compute frequently needed or computationally expensive expressions and save their result as a new set of time series. This is useful if you want to run alerts on aggregated data or if you have dashboards that query computationally expensive expressions repeatedly.

Grafana Enterprise offers an alternative to recorded rules in the form of recorded queries that can be executed against any data source.

For more information on recording rules in Prometheus, refer to [recording rules](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/).
