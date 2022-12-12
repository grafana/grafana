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

Grafana supports several alert rule types, the following sections will explain their merits and demerits and help you choose the right alert type for your use case.

## Grafana managed rules

Grafana-managed rules are the most flexible alert rule type. They allow you to create alerts that can act on data from any of your existing data sources.

In additional to supporting any datasource you can also add additional [expressions]({{< relref "../../../panels-visualizations/query-transform-data/expression-queries/" >}}) to transform your data and express alert conditions.

## Mimir, Loki and Cortex rules

To create Mimir, Loki or Cortex alerts you must have a compatible Prometheus data source. You can check if your data source is compatible by testing the data source and checking the details if the ruler API is supported.

{{< figure src="/static/img/docs/alerting/unified/mimir-datasource-check.png" caption="Successfully connected to a Mimir Prometheus datasource" max-width="40%" >}}

## Recording rules

Recording rules are only available for compatible Prometheus data sources like Mimir, Loki and Cortex.

A recording rule allows you to save an expression's result to a new set of time series. This is useful if you want to run alerts on aggregated data or if you have dashboards that query the same expression repeatedly.

Read more about [recording rules](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/) in Prometheus.
