---
description: Use template variables with the Zipkin data source in Grafana
keywords:
  - grafana
  - zipkin
  - tracing
  - template variables
  - variables
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Template variables
title: Zipkin template variables
weight: 300
review_date: 2026-04-08
---

# Zipkin template variables

Use template variables to create dynamic, reusable dashboards. Instead of hard-coding trace IDs, you can use variables to make your dashboards interactive.

For an introduction to Grafana template variables, refer to [Variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/).

## Supported variable types

| Variable type | Supported |
| ------------- | --------- |
| Custom        | Yes       |
| Text box      | Yes       |
| Data source   | Yes       |
| Query         | No        |

The Zipkin data source doesn't support query-based variables, but you can use custom or text box variables to parameterize trace ID queries.

## Use variables in queries

You can use template variables in the **Trace ID** field of the query editor. Grafana replaces the variable with its current value when the query runs.

For example, if you have a variable named `traceId`, enter `${traceId}` in the trace ID field. When the variable value changes, the query automatically runs with the new trace ID.

For more information about variable syntax, refer to [Variable syntax](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/).
