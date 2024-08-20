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
The queries use [TraceQL](/docs/tempo/latest/traceql), the query language designed specifically for tracing.

You don't have to know TraceQL to create your own queries.

For general documentation on querying data sources in Grafana, refer to [Query and transform data](ref:query-transform-data).

## Before you begin

You can compose TraceQL queries in Grafana and Grafana Cloud using **Explore** and a Tempo data source.

### TraceQL knowledge helpful, but not required

You don't have to know TraceQL to create a query.
You can use the Build mode's user interface to select options to search your data.
These selections generate a TraceQL query.
Any query generated in Build mode can be transferred to the Code mode, where you can edit the query directly.

To learn more about how to query by TraceQL, refer to the [TraceQL documentation](/docs/tempo/latest/traceql).

## Choose a query editing mode

The query editor has three modes, or **Query types**, that you can use to explore your tracing data.
You can use these modes by themselves or in combination to create building blocks to generate custom queries.

![The three query types: Search, TraceQL, and Service Graph](/media/docs/grafana/data-sources/tempo/query-editor/tempo-ds-query-types.png)

The three **Query types** are:

- The **Search** query type, also called the query builder, provides a user interface for building a TraceQL query.
- The **TraceQL** query type, also called the query editor, lets you write your own TraceQL query with assistance from autocomplete.
- The **Service Graph** query type displays a visual relationship between services. Refer to the [Service graph](ref:service-graph) documentation for more information.

### Query builder

The TraceQL query builder, located on the **Explore** > **Query type** > **Search** in Grafana, provides drop-downs and text fields to help you write a query.

Refer to the [Search using the TraceQL query builder documentation]({{< relref "./traceql-search" >}}) to learn more about creating queries using convenient drop-down menus.

![The TraceQL query builder](/static/img/docs/tempo/screenshot-traceql-query-type-search-v10.png)

### TraceQL Query editor

The TraceQL query editor, located on the **Explore** > **TraceQL** tab in Grafana, lets you search by trace ID and write TraceQL queries using autocomplete.

Refer to the [TraceQL query editor documentation]({{< relref "./traceql-editor" >}}) to learn more about constructing queries using a code-editor-like experience.

![The TraceQL query editor](/static/img/docs/tempo/screenshot-traceql-query-editor-v10.png)

You can also search for a Trace ID by entering a trace ID into the query field.

### Service graph

Grafana’s service graph view uses metrics to display span request rates, error rates, and durations, as well as service graphs.
Once the requirements are set up, this pre-configured view is immediately available.

Using the service graph view, you can:

- Discover spans which are consistently erroring and the rates at which they occur
- Get an overview of the overall rate of span calls throughout your services
- Determine how long the slowest queries in your service take to complete
- Examine all traces that contain spans of particular interest based on rate, error, and duration values (RED signals)

For more information about the service graph, refer to [Service graph](../service-graph/).

{{< figure src="/media/docs/grafana/data-sources/tempo/query-editor/tempo-ds-query-service-graph.png" class="docs-image--no-shadow" max-width="500px" caption="Screenshot of the Service Graph view" >}}

## Use TraceQL panels in dashboards

To add TraceQL panels to your dashboard, refer to the [Traces panel documentation](/docs/grafana/latest/panels-visualizations/visualizations/traces/).

To learn more about Grafana dashboards, refer to the [Use dashboards documentation](/docs/grafana/latest/dashboards/use-dashboards/).

## Set options for query types

The following options are available for the **Search** and **TraceQL** query types:

Limit
: Determines the maximum number of traces to return. Default value is `20`.

Span Limit
: Sets the maximum number of spans to return for each spanset. Default value is `3`.

Table Format
: Determines whether the query results table is displayed focused on **Traces** or **Spans**. **Traces** is the default selection.

Step
: Defines the step for metrics quires. Use duration notation, for example, `30ms` or `1m`.

Streaming
: Indicates if streaming is currently enabled. Streaming lets you view partial query results before the entire query completes.
