---
description: Learn how to create TraceQL queries in Grafana using the query editor.
keywords:
  - grafana
  - tempo
  - traces
  - queries
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Write TraceQL queries
title: Write TraceQL queries with the editor
weight: 300
---

# Write TraceQL queries with the editor

Inspired by PromQL and LogQL, TraceQL is a query language designed for selecting traces.
TraceQL provides a method for formulating precise queries so you can zoom in to the data you need.
Query results are returned faster because the queries limit what is searched.

To learn more about how to query by TraceQL, refer to the [TraceQL documentation](/docs/tempo/latest/traceql).

The TraceQL query editor, located on the **Explore** > **TraceQL** tab, lets you search by trace ID and write TraceQL queries using autocomplete.

![The TraceQL query editor](/static/img/docs/tempo/screenshot-traceql-query-editor-v10.png)

## Enable TraceQL query editor

This feature is automatically available in Grafana 10 (and newer) and Grafana Cloud.

To use the TraceQL query editor in self-hosted Grafana 9.3.2 and older, you need to [enable the `traceqlEditor` feature toggle](/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/).

[//]: # 'Shared content for the TraceQL query editor'

{{< docs/shared source="grafana" lookup="datasources/tempo-editor-traceql.md" leveloffset="+1" version="<GRAFANA VERSION>" >}}
