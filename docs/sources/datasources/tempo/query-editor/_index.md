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
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  service-graph:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/tempo/service-graph/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/tempo/service-graph/
  recorded-queries:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/recorded-queries/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/recorded-queries/
  query-history-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/query-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/query-management/
  query-inspector:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/explore-inspector/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/explore-inspector/
  explore-traces-app:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/simplified-exploration/traces/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/simplified-exploration/traces/
---

# Query tracing data

The Tempo data source's query editor helps you query and display traces from Tempo in [Explore](ref:explore).
The queries use [TraceQL](/docs/tempo/latest/traceql), the query language designed specifically for tracing.

For general documentation on querying data sources in Grafana, refer to [Query and transform data](ref:query-transform-data).

{{< admonition type="tip" >}}
Don't know TraceQL? Try [Explore Traces](ref:explore-traces-app), an intuitive, queryless app that lets you explore your tracing data using RED metrics.
{{< /admonition >}}

## Before you begin

You can compose TraceQL queries in Grafana and Grafana Cloud using **Explore** and a Tempo data source.

### TraceQL knowledge helpful, but not required

You don't have to know TraceQL to create a query.
You can use the **Search** query builder's user interface to select options to search your data.
These selections generate a TraceQL query.
Any query generated using **Search** query builder can be transferred to the **TraceQL** query editor, where you can edit the query directly.

To learn more about how to query by TraceQL, refer to the [TraceQL documentation](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql).

## Choose a query editing mode

The query editor has three **Query types** that you can use to explore your tracing data.
You can use these modes by themselves or in combination to create building blocks to generate custom queries.
Adding another query adds a new query block.
Refer to [Use query types together](#use-query-types-together) for more information.

![The three query types: Search, TraceQL, and Service Graph](/media/docs/grafana/data-sources/tempo/query-editor/tempo-ds-query-types.png)

The three query types are:

- **Search** query builder - Provides a user interface for building a TraceQL query.
- **TraceQL** query editor - Lets you write your own TraceQL query with assistance from autocomplete.
- **Service Graph** view - Displays a visual relationship between services. Refer to the [Service graph](ref:service-graph) documentation for more information.

### Search query builder

The **Search** query builder provides drop-down lists and text fields to help you write a query.
The query builder is ideal for people who aren't familiar with or want to learn TraceQL.

Refer to the [Search using the TraceQL query builder documentation]({{< relref "./traceql-search" >}}) to learn more about creating queries using convenient drop-down menus.

![The Search query builder](/media/docs/grafana/data-sources/tempo/query-editor/tempo-ds-query-search-v11.png)

### TraceQL query editor

The **TraceQL** query editor lets you search by trace ID and write TraceQL queries using autocomplete.

Refer to the [TraceQL query editor documentation]({{< relref "./traceql-editor" >}}) to learn more about constructing queries using a code-editor-like experience.

![The TraceQL query editor](/media/docs/grafana/data-sources/tempo/query-editor/tempo-ds-query-traceql-v11.png)

You can also search for a trace ID by entering it into the query field.

### Service graph view

Grafana’s **Service Graph** view uses metrics to display span request rates, error rates, and durations, as well as service graphs.
Once the requirements are set up, this preconfigured view is immediately available.

Using the service graph view, you can:

- Discover spans which are consistently erroring and the rates at which they occur.
- Get an overview of the overall rate of span calls throughout your services.
- Determine how long the slowest queries in your service take to complete.
- Examine all traces that contain spans of particular interest based on rate, error, and duration values (RED signals).

For more information about the service graph, refer to [Service graph](../service-graph).

![Screenshot of the Service Graph view](/media/docs/grafana/data-sources/tempo/query-editor/tempo-ds-query-service-graph.png)

## Use TraceQL panels in dashboards

To add TraceQL panels to your dashboard, refer to the [Traces panel documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/traces/).

To learn more about Grafana dashboards, refer to the [Use dashboards documentation](/docs/grafana/<GRAFANA_VERSION>/dashboards/use-dashboards/).

## Set options for query builder and editor

The following options are available for the **Search** and **TraceQL** query types.
You can modify these settings in the **Options** section.

![Options section in the query editors](/media/docs/grafana/data-sources/tempo/query-editor/tempo-ds-options.png)

After changing any option, re-run the query to apply the updates.

Limit
: Determines the maximum number of traces to return. Default value is `20`.

Span Limit
: Sets the maximum number of spans to return for each spanset. Default value is `3`.

Table Format
: Determines whether the query results table is displayed focused on **Traces** or **Spans**. **Traces** is the default selection. When **Traces** is selected, the results table starts with the trace ID. When **Spans** is selected, the table starts with the trace service.

Step
: Defines the step for metrics queries. Use duration notation, for example, `30ms` or `1m`.

Streaming
: Indicates if streaming is active. Streaming lets you view partial query results before the entire query completes. Activating streaming adds the **Table - Streaming Progress** section to the query results.

## Use query types together

You can use **+ Add query** to create customized queries that use one or more of the query types together.
Each time you add a new query, it adds a new section, or query block, that contains **Search**, **TraceQL**, or **Service Graph** user interface.

The added query and results table appear in the navigation under **Queries** and **Tables** respectively.
You can use the navigation to view query, results table, and service graph blocks.

{{< video-embed src="/media/docs/grafana/data-sources/tempo/query-editor/tempo-ds-editor.mp4" max-width="800px" class="my-cool-video" caption="Navigating through the query blocks" align="center" >}}

To add a query block:

1. Select **+ Add query**.
1. Choose a query type: **Search**, **TraceQL**, or **Service Graph**.

To remove a query block, select the **Remove query** trash can icon.

To rename a block, select the **Rename** edit icon next to the query block name.
The name changes in the queries and table list.

### Additional query block options

Each query block has a set of icons in the right top corner.

![The additional options toolbar](/media/docs/grafana/data-sources/tempo/query-editor/tempo-ds-additional-options-toolbar.png)

These icons include:

Show data source help
: Displays the **Tempo Cheat Sheet** with links to documentation.

Create recorded query
: Lets you save the current query block as a recorded query. This option is available in Grafana Cloud and Grafana Enterprise. For more information, refer to [Recorded queries](ref:recorded-queries).

Duplicate query
: Copies the current block and adds a new identical block.

Remove query
: Deletes the query block.

### Use query history and query inspector

**Explore** provides a history of all queries you've used within a data source and an inspector that lets you view stats, inspect queries, view JSON, and general information for your data source queries.

For more information, refer to the [Query inspector in Explore](ref:query-inspector) and [Query management in Explore](ref:query-history-management) documentation.

## Cross-tenant TraceQL queries

If you've configured a multi-stack Tempo data source, you can perform TraceQL queries across those stacks and tenants.

Queries performed using the cross-tenant configured data source, in either **Explore** or inside of dashboards,
are performed across all the tenants that you specified in the **X-Scope-OrgID** header.

<!-- vale Grafana.Spelling = NO -->

TraceQL queries that compare multiple spansets may not correctly return all traces in a cross-tenant query. For instance,

<!-- vale Grafana.Quotes = YES -->

```
{ span.attr1 = "bar" } && { span.attr2 = "foo" }
```

TraceQL evaluates a contiguously stored trace.
If these two conditions are satisfied in separate tenants, then Tempo doesn't return the trace.

Refer to [Set up a multi-stack Tempo data source in Grafana](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/multi-stack-data-sources/#set-up-a-multi-stack-tempo-data-source-in-grafana) for information about configuring the Tempo data source.

For information about Tempo configuration requirements, refer to the [Cross-tenant query](https://grafana.com/docs/tempo/<TEMPO_VERSION>/operations/cross_tenant_query/) and [Enable multitenancy](https://grafana.com/docs/tempo/<TEMPO_VERSION>/operations/multitenancy/) documentation.
