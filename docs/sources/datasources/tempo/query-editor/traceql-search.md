---
description: Learn how to create TraceQL queries in Grafana using Explore > Search.
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
menuTitle: Search traces
title: Search traces using TraceQL query builder
weight: 300
---

# Search traces using TraceQL query builder

Inspired by PromQL and LogQL, TraceQL is a query language designed for selecting traces.
TraceQL provides a method for formulating precise queries so you can zoom in to the data you need.
Query results are returned faster because the queries limit what is searched.

To learn more about how to query by TraceQL, refer to the [TraceQL documentation](/docs/tempo/latest/traceql).

The TraceQL query builder, located on the **Explore** > **Query type** > **Search** in Grafana, provides drop-downs and text fields to help you write a query.

![The TraceQL query builder](/static/img/docs/tempo/screenshot-traceql-query-type-search-v10.png)

## Enable Search with the query builder

This feature is automatically available in Grafana 10 (and newer) and Grafana Cloud.

To enable the TraceQL query builder in self-hosted Grafana through version 10.1, [enable the `traceqlSearch` feature toggle](/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/).

[//]: # 'Shared content for the Search - TraceQL query builder'

{{< docs/shared source="grafana" lookup="datasources/tempo-search-traceql.md" leveloffset="+1" version="<GRAFANA VERSION>" >}}
