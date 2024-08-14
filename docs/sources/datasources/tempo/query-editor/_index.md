---
aliases:
  - ../../data-sources/tempo/query-editor/
description: Guide for using the Tempo data source's query editor
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
menuTitle: Query tracing data
title: Query tracing data
weight: 300
refs:
  query-transform-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/
  service-graph:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/tempo/service-graph/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/tempo/service-graph/
---

# Query tracing data

The Tempo data source's query editor helps you query and display traces from Tempo in [Explore](ref:explore).
Most queries are created using [TraceQL](/docs/tempo/latest/traceql), the query language designed specifically for tracing.
The Tempo data source query editor provides three interfaces:

- The **Search** query type, also called the query builder, provides a user interface for building a TraceQL query.
- The **TraceQL** query type, where you can write your own TraceQL query with autocomplete help.
- The **Service Graph** query type, which displays a visual relationship between services. Refer to the [Service graph](ref:service-graph) documentation for more information.

Your queries can use one or more of these query types.

You don't have to know TraceQL to create a query.
You can use the **Search** query type query builder's user interface to select options to search your data.
These selections generate a TraceQL query.
You can also create a query using the Search query builder and then edit it in the TraceQL query editor.

This topic explains queries specific to the Tempo data source.
For general documentation on querying data sources in Grafana, see [Query and transform data](ref:query-transform-data).

## Before you begin

You can compose TraceQL queries in Grafana and Grafana Cloud using **Explore** and a Tempo data source.

To learn more about how to query by TraceQL, refer to the [TraceQL documentation](/docs/tempo/latest/traceql).

### TraceQL query builder

The TraceQL query builder, located on the **Explore** > **Query type** > **Search** in Grafana, provides drop-downs and text fields to help you write a query.

Refer to the [Search using the TraceQL query builder documentation]({{< relref "./traceql-search" >}}) to learn more about creating queries using convenient drop-down menus.

![The TraceQL query builder](/static/img/docs/tempo/screenshot-traceql-query-type-search-v10.png)

### TraceQL query editor

The TraceQL query editor, located on the **Explore** > **TraceQL** tab in Grafana, lets you search by trace ID and write TraceQL queries using autocomplete.

Refer to the [TraceQL query editor documentation]({{< relref "./traceql-editor" >}}) to learn more about constructing queries using a code-editor-like experience.

![The TraceQL query editor](/static/img/docs/tempo/screenshot-traceql-query-editor-v10.png)

## Query by TraceID

To query a particular trace:

1. Select the **TraceQL** query type.
1. Enter the trace's ID into the query field.

{{< figure src="/static/img/docs/tempo/query-editor-traceid.png" class="docs-image--no-shadow" max-width="750px" caption="Screenshot of the Tempo TraceID query type" >}}

## Use TraceQL panels in dashboards

To add TraceQL panels to your dashboard, refer to the [Traces panel documentation](/docs/grafana/latest/panels-visualizations/visualizations/traces/).

To learn more about Grafana dashboards, refer to the [Use dashboards documentation](/docs/grafana/latest/dashboards/use-dashboards/).
