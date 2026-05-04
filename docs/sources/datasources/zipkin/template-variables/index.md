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

Use template variables to create dynamic, reusable dashboards. Instead of hard-coding trace IDs, you can use variables to let dashboard viewers select or input trace IDs at view time, making it easier to share dashboards across teams.

For an introduction to Grafana template variables, refer to [Variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/).

## Supported variable types

| Variable type | Description                                       | Supported |
| ------------- | ------------------------------------------------- | --------- |
| Custom        | Define a fixed list of trace IDs or other values. | Yes       |
| Text box      | Let users type a trace ID at dashboard view time. | Yes       |
| Data source   | Let users switch between Zipkin instances.        | Yes       |
| Query         | Populate options from a data source query.        | No        |

The Zipkin data source doesn't support query-based variables, but you can use custom or text box variables to parameterize trace ID queries.

## Create a text box variable

A text box variable lets dashboard viewers enter a trace ID directly. This is the most common variable type for Zipkin.

To create a text box variable:

1. Navigate to **Dashboard settings** > **Variables**.
1. Click **Add variable**.
1. Select **Textbox** as the variable type.
1. Set the **Name** to `traceId`.
1. Optionally, set a **Default value** with a known trace ID for initial display.
1. Click **Apply**.

The dashboard displays a text input where viewers can paste a trace ID.

## Create a custom variable

A custom variable provides a predefined list of values. This is useful when you want to give viewers a set of known trace IDs to choose from.

To create a custom variable:

1. Navigate to **Dashboard settings** > **Variables**.
1. Click **Add variable**.
1. Select **Custom** as the variable type.
1. Set the **Name** to `traceId`.
1. Enter trace IDs in the **Values separated by comma** field:

   ```
   efe9cb8857f68c8f,463ac35c9f6413ad48485a3953bb6124
   ```

1. Click **Apply**.

The dashboard displays a drop-down where viewers can select from the predefined trace IDs.

## Create a data source variable

A data source variable lets viewers switch between multiple Zipkin instances. This is useful when you have separate Zipkin deployments for different environments.

To create a data source variable:

1. Navigate to **Dashboard settings** > **Variables**.
1. Click **Add variable**.
1. Select **Data source** as the variable type.
1. Set the **Name** to `zipkinDs`.
1. Select **Zipkin** as the **Type**.
1. Click **Apply**.

Then, in your panel's query editor, select `${zipkinDs}` as the data source instead of a specific Zipkin instance.

## Use variables in queries

You can use template variables in the **Trace ID** field of the query editor. Grafana replaces the variable with its current value when the query runs.

For example, if you create a text box variable named `traceId`, enter `${traceId}` in the trace ID field. When the viewer enters a new trace ID, the query automatically runs with the new value.

For more information about variable syntax, refer to [Variable syntax](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/).

## Troubleshoot template variable issues

If template variables aren't working as expected, refer to [Troubleshoot Zipkin data source issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/zipkin/troubleshooting/).
