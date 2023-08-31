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
menuTitle: Query editor
title: Tempo query editor
weight: 300
---

# Tempo query editor

The Tempo data source's query editor helps you query and display traces from Tempo in [Explore][explore].

This topic explains configuration and queries specific to the Tempo data source.
For general documentation on querying data sources in Grafana, see [Query and transform data][query-transform-data].

To add TraceQL panels to your dashboard, refer to the [Traces panel documentation](/docs/grafana/latest/panels-visualizations/visualizations/traces/).

To learn more about Grafana dashboards, refer to the [Use dashboards documentation](/docs/grafana/latest/dashboards/use-dashboards/).

## Write TraceQL queries in Grafana

Inspired by PromQL and LogQL, TraceQL is a query language designed for selecting traces.
The default traces search reviews the whole trace.
TraceQL provides a method for formulating precise queries so you can zoom in to the data you need.
Query results are returned faster because the queries limit what is searched.

You can compose TraceQL queries in Grafana and Grafana Cloud using **Explore** and a Tempo data source. You can use either the **Query type** > **Search** (the TraceQL query builder) or the **TraceQL** tab (the TraceQL query editor).
Both of these methods let you build queries and drill-down into result sets.

To learn more about how to query by TraceQL, refer to the [TraceQL documentation](/docs/tempo/latest/traceql).

### TraceQL query builder

The TraceQL query builder, located on the **Explore** > **Query type** > **Search** in Grafana, provides drop-downs and text fields to help you write a query.

Refer to the [Search using the TraceQL query builder documentation]({{< relref "./traceql-search" >}}) to learn more about creating queries using convenient drop-down menus.

![The TraceQL query builder](/static/img/docs/tempo/screenshot-traceql-query-type-search-v10.png)

### TraceQL query editor

The TraceQL query editor, located on the **Explore** > **TraceQL** tab in Grafana, lets you search by trace ID and write TraceQL queries using autocomplete.

Refer to the [TraceQL query editor documentation]({{< relref "./traceql-editor" >}}) to learn more about constructing queries using a code-editor-like experience.

![The TraceQL query editor](/static/img/docs/tempo/screenshot-traceql-query-editor-v10.png)

## Query by search (deprecated)

{{% admonition type="caution" %}}
Starting with Grafana v10.2, this query type has been deprecated. It will be removed in Grafana v10.3.
{{% /admonition %}}

Use this to search for traces by service name, span name, duration range, or process-level attributes that are included in your application's instrumentation, such as HTTP status code and customer ID.

To configure Tempo and the Tempo data source for search, refer to [Configure the data source]({{< relref "../#configure-the-data-source" >}}).

To search for traces:

1. Select **Search** from the **Query** type selector.
1. Fill out the search form:

| Name             | Description                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Service Name** | Returns a list of services.                                                                                                       |
| **Span Name**    | Returns a list of span names.                                                                                                     |
| **Tags**         | Sets tags with values in the [logfmt](https://brandur.org/logfmt) format, such as `error=true db.statement="select * from User"`. |
| **Min Duration** | Filters all traces with a duration higher than the set value. Possible values are `1.2s`, `100ms`, `500us`.                       |
| **Max Duration** | Filters all traces with a duration lower than the set value. Possible values are `1.2s`, `100ms`, `500us`.                        |
| **Limit**        | Limits the number of traces returned.                                                                                             |

{{< figure src="/static/img/docs/explore/tempo-search.png" class="docs-image--no-shadow" max-width="750px" caption="Screenshot of the Tempo search feature with a trace rendered in the right panel" >}}

### Search recent traces

You can search recent traces held in Tempo's ingesters.
By default, ingesters store the last 15 minutes of tracing data.

To configure your Tempo data source to use this feature, refer to the [Tempo documentation](/docs/tempo/latest/getting-started/tempo-in-grafana/#search-of-recent-traces).

### Search the backend datastore

Tempo includes the ability to search the entire backend datastore.

To configure your Tempo data source to use this feature, refer to the [Tempo documentation](/docs/tempo/latest/getting-started/tempo-in-grafana/#search-of-the-backend-datastore).

## Query by TraceID

To query a particular trace:

1. Select the **TraceQL** query type.
1. Enter the trace's ID into the query field.

{{< figure src="/static/img/docs/tempo/query-editor-traceid.png" class="docs-image--no-shadow" max-width="750px" caption="Screenshot of the Tempo TraceID query type" >}}

## Query Loki for traces

To find traces to visualize, you can use the [Loki query editor]({{< relref "../../loki#loki-query-editor" >}}).
For results, you must configure [derived fields]({{< relref "../../loki#configure-derived-fields" >}}) in the Loki data source that point to this data source.

{{< figure src="/static/img/docs/tempo/query-editor-search.png" class="docs-image--no-shadow" max-width="750px" caption="Screenshot of the Tempo query editor showing the Loki Search tab" >}}

{{% docs/reference %}}
[explore]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/explore"
[explore]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/explore"

[query-transform-data]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/query-transform-data"
[query-transform-data]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations/query-transform-data"
{{% /docs/reference %}}
