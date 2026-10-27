---
aliases:
  - ../../data-sources/tempo/query-editor/
  - traceql-structure/
  - ../traces-in-grafana/json-trace-file/
  - ../json-trace-file/
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
---

# Query tracing data

The Tempo data source's query editor helps you query and display traces from Tempo in [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/).
The queries use [TraceQL](https://grafana.com/docs/tempo/latest/traceql), the query language designed specifically for tracing.

For general documentation on querying data sources in Grafana, refer to [Query and transform data](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/).

{{< admonition type="tip" >}}
Don't know TraceQL? Try [Grafana Traces Drilldown](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/simplified-exploration/traces/), an intuitive, queryless app that lets you explore your tracing data using RED metrics.
{{< /admonition >}}

## Before you begin

You can compose TraceQL queries in Grafana and Grafana Cloud using **Explore** and a Tempo data source.

{{< admonition type="note" >}}
Before running queries, verify that your Tempo data source is configured and connected.
If queries return no results or errors, refer to [Configure the Tempo data source](../configure-tempo-data-source/) to check your connection and authentication settings.
{{< /admonition >}}

You don't have to know TraceQL to create a query.
The **Search** query builder lets you select options from drop-down lists to build a query visually.
These selections generate a TraceQL query that you can transfer to the **TraceQL** editor to refine further.

TraceQL queries follow the pattern `{ conditions } | pipeline`, where conditions inside `{}` select spans and pipeline operators like `count()` or `avg()` aggregate results.
To learn the full syntax, refer to [Construct a TraceQL query](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql/construct-traceql-queries/).
For a language overview, refer to the [TraceQL documentation](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql).

## Choose a query editing mode

The query editor has four **Query types** that you can use to explore your tracing data.
You can use these modes by themselves or in combination to create building blocks to generate custom queries.
Adding another query adds a new query block.
Refer to [Use query types together](#use-query-types-together) for more information.

![The three query types: Search, TraceQL, and Service Graph](/media/docs/grafana/data-sources/tempo/query-editor/tempo-ds-query-types.png)

### Search query builder

Start here if you're exploring data or learning TraceQL.
The **Search** query builder provides drop-down lists and text fields to build a query visually without needing to know TraceQL syntax.
Your selections automatically generate a TraceQL query that you can copy to the editor for further refinement.

Refer to [Search traces using the query builder](traceql-search/) for more information.

![The Search query builder](/media/docs/grafana/data-sources/tempo/query-editor/tempo-ds-query-search-v11.png)

### TraceQL query editor

Use the **TraceQL** editor when you need complex filters, structural queries across parent and child spans, or aggregations that the Search builder doesn't support.
The editor provides autocomplete for attribute names, scopes, and operators.
To look up a single trace by its ID, use the [**Trace ID** query type](#trace-id-query).

For copy-paste query examples, refer to [TraceQL query examples](traceql-query-examples/).
Refer to [Write TraceQL queries with the editor](traceql-editor/) for more information.

![The TraceQL query editor](/media/docs/grafana/data-sources/tempo/query-editor/tempo-ds-query-traceql-v11.png)

### Trace ID query

Use the **Trace ID** query type to retrieve a single trace when you already know its ID, for example from a log line, an error report, or a link.
Unlike the **TraceQL** editor, it provides options to shrink the returned trace: you can collapse repeated spans with span pruning and filter the trace to the spans you care about.

To look up a trace:

1. Select the **Trace ID** query type.
1. Enter the trace ID in the **Trace ID** field.
   The field is marked invalid if the value doesn't start with letters and numbers.
1. Press <kbd>Enter</kbd> to run the query.

The **Trace ID** field accepts only a trace ID.

{{< admonition type="note" >}}
Span pruning is an experimental Tempo feature and requires Tempo 3.1 or later.
If your Tempo version doesn't support the span pruning or filter options, Tempo ignores them and Grafana shows the full trace without an error.
The span pruning and filter options might change in future releases.
For details about the underlying request parameters, refer to the [Tempo HTTP API documentation](https://grafana.com/docs/tempo/<TEMPO_VERSION>/api_docs/#query-v2).
{{< /admonition >}}

#### Span Pruning Options

Span pruning collapses groups of similar leaf spans into a single summary span, which makes large traces easier to read and smaller to load.
Each summary span records how many spans it replaces.

Expand **Span Pruning Options** to change how pruning behaves.
The collapsed section shows a summary of the current values.

On/Off
: Turns span pruning on or off for this query. Default value is **On**.

Group By
: A comma-separated list of attribute names used to group spans for pruning, for example `db.sql.table, http.method`. Spans are grouped when they share a name, kind, and status. Spans must also have identical values for every attribute listed here. By default, no attributes are used.

Min Spans
: The minimum number of similar spans required in a group before pruning is applied. Groups smaller than this value are left as they are. Default value is `5`.

Max Parent Depth
: How many ancestor levels above the aggregated leaf spans can also be aggregated. Use `0` to aggregate only leaves, `-1` for unlimited depth, or `n` for a bounded depth. Default value is `1`.

#### Filter Options

Filter options reduce the returned trace to the spans that match a TraceQL filter.
Expand **Filter Options** to set them.
You can expand **Span Pruning Options** and **Filter Options** independently.

Filter
: A TraceQL spanset filter evaluated against the spans in the trace, for example `{ status = error && name = "foo" }`. The filter supports a single `{ ... }` block. Chained filters and pipelines aren't supported. Leave the field empty to skip filtering. The field shows an error when the filter isn't valid.

Keep Hierarchy
: Includes each matched span's ancestor path back to the root, so the result displays as a complete waterfall instead of only the matching spans. Default value is **Off**.

Match Depth
: How many levels of descendants to keep below each matched span, independent of **Keep Hierarchy**. Use `-1` to keep all descendants, `0` for only the matched spans, or `n` for a bounded depth. Default value is `0`.

Ancestor Depth
: How many levels of ancestors to keep above each matched span. Use `-1` for the whole path to the root, `0` for none, or `n` for a bounded depth. Only used when **Keep Hierarchy** is on. Default value is `-1`.

**Keep Hierarchy**, **Match Depth**, and **Ancestor Depth** are disabled until **Filter** contains a valid filter.
**Ancestor Depth** is also disabled while **Keep Hierarchy** is off.
Select **Clear Filter** to remove the filter and reset all filter options.

##### Example: focus on one service in a large trace

A trace that spans many services can contain thousands of spans, and most of them are rarely relevant to the problem you're investigating.
Use **Filter** and **Match Depth** to load only the part of the trace you care about.

For example, you're investigating slow requests in the `checkout` service, and the trace passes through dozens of other services.
To show only the work that starts in `checkout`:

1. In **Filter Options**, set **Filter** to `{ resource.service.name = "checkout" }`.
1. Set **Match Depth** to `-1`.
1. Run the query.

The filter matches every span that belongs to the `checkout` service.
Because **Match Depth** is `-1`, Tempo also keeps all descendants of each matched span, so you still see everything those spans called downstream.
The rest of the trace is left out.

To see where `checkout` sits in the wider request, turn **Keep Hierarchy** on.
Tempo then also keeps each matched span's ancestors back to the root, so the result displays as a complete waterfall.
Use **Ancestor Depth** to limit how many ancestor levels are kept.

To narrow the result further, add conditions to the filter, for example `{ resource.service.name = "checkout" && status = error }`.
You can combine the filter with span pruning to also collapse repeated spans in the part of the trace you kept.

### Service graph view

The **Service Graph** view answers a different question than trace search: instead of finding individual traces, it visualizes how your services connect and highlights request rate, error rate, and duration (RED metrics) across those connections.

Using the Service Graph view, you can:

- Discover spans that consistently return errors and the rates at which they occur.
- Get an overview of the overall rate of span calls throughout your services.
- Determine how long the slowest queries in your service take to complete.
- Examine all traces that contain spans of particular interest based on rate, error, and duration values (RED signals).

The Service Graph requires metrics generation to be configured.
For more information, refer to [Service Graph and Service Graph view](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/service-graph/).

![Screenshot of the Service Graph view](/media/docs/grafana/data-sources/tempo/query-editor/tempo-ds-query-service-graph.png)

## Understand search behavior

Tempo search is non-deterministic. When you run a search, Tempo performs a massively parallel scan over the selected time range and returns the first N matching results. Even identical searches can return different results due to variations in machine load and network latency.

This design prioritizes speed over predictability. To make results deterministic, append a `with` clause to your TraceQL queries, for example `{ status = error } with (most_recent=true)`, so Tempo returns the most recent matching traces. For more information, refer to [Retrieve most recent results](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql/#retrieve-most-recent-results).

## Use TraceQL panels in dashboards

To add TraceQL panels to your dashboard, refer to the [Traces panel documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/traces/).

To learn more about Grafana dashboards, refer to the [Use dashboards documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/use-dashboards/).

For example dashboards with traces, visit [Grafana Play](https://play.grafana.org).

## Set options for query builder and editor

The following options are available for the **Search** and **TraceQL** query types.
You can modify these settings in the **Options** section.
The **Trace ID** query type has its own options, described in [Trace ID query](#trace-id-query).

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
Each time you add a new query, it adds a new section, or query block, that contains **Search**, **TraceQL**, **Trace ID**, or **Service Graph** user interface.

The added query and results table appear in the navigation under **Queries** and **Tables** respectively.
You can use the navigation to view query, results table, and service graph blocks.

{{< video-embed src="/media/docs/grafana/data-sources/tempo/query-editor/tempo-ds-editor.mp4" max-width="800px" class="my-cool-video" caption="Navigating through the query blocks" align="center" >}}

To add a query block:

1. Select **+ Add query**.
1. Choose a query type: **Search**, **TraceQL**, **Trace ID**, or **Service Graph**.

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
: Lets you save the current query block as a recorded query. This option is available in Grafana Cloud and Grafana Enterprise. For more information, refer to [Recorded queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/recorded-queries/).

Duplicate query
: Copies the current block and adds a new identical block.

Remove query
: Deletes the query block.

### Use query history and query inspector

**Explore** provides a history of all queries you've used within a data source and an inspector that lets you view stats, inspect queries, view JSON, and general information for your data source queries.

For more information, refer to the [Query inspector in Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/explore-inspector/) and [Query management in Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/query-management/) documentation.

## Upload a JSON trace file

You can upload a JSON file that contains a single trace and visualize it.
If the file has multiple traces, Grafana visualizes the first trace.

To upload a trace file:

1. Select **Explore** in Grafana.
1. Select **Import trace** next to the query type selector.
1. Upload your JSON trace file.

To download a trace or Service Graph through the [Inspector panel](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/explore-inspector/):

1. Open the inspector.
1. Navigate to the **Data** tab.
1. Click **Download traces** or **Download Service Graph**.

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

## Next steps

- [TraceQL query examples](traceql-query-examples/) - Copy-paste query examples for common use cases
- [Construct a TraceQL query](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql/construct-traceql-queries/) - Full TraceQL syntax, scopes, and operators
- [Service Graph and Service Graph view](../service-graph/) - Visualize service dependencies and RED metrics
- [Span filters](../span-filters/) - Refine trace results after querying
- [Configure the Tempo data source](../configure-tempo-data-source/) - Connection, authentication, and feature settings
