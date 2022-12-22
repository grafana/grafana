---
aliases:
  - ../../data-sources/tempo/query-editor/
description: Guide for using the Tempo data source's query editor
keywords:
  - grafana
  - tempo
  - traces
  - queries
menuTitle: Query editor
title: Tempo query editor
weight: 300
---

# Tempo query editor

The Tempo data source's query editor helps you query and display traces from Tempo in [Explore]({{< relref "../../../explore" >}}).

This topic explains configuration and queries specific to the Tempo data source.
For general documentation on querying data sources in Grafana, see [Query and transform data]({{< relref "../../../panels-visualizations/query-transform-data" >}}).

## Query Tempo search

Tempo search is an experimental feature behind a feature toggle.
Use this to search for traces by service name, span name, duration range, or process-level attributes that are included in your application's instrumentation, such as HTTP status code and customer ID.

To configure Tempo and the Tempo data source for search, refer to [Configure the data source]({{< relref "../#configure-the-data-source" >}}).

{{< figure src="/static/img/docs/explore/tempo-search.png" class="docs-image--no-shadow" max-width="750px" caption="Screenshot of the Tempo search feature with a trace rendered in the right panel" >}}

### Search recent traces

You can search recent traces held in Tempo's ingesters.
By default, ingesters store the last 15 minutes of tracing data.

To configure your Tempo data source to use this feature, refer to the [Tempo documentation](/docs/tempo/latest/getting-started/tempo-in-grafana/#search-of-recent-traces).

### Search the backend datastore

Tempo includes the ability to search the entire backend datastore.

To configure your Tempo data source to use this feature, refer to the [Tempo documentation](/docs/tempo/latest/getting-started/tempo-in-grafana/#search-of-the-backend-datastore).

## Query Loki for traces

To find traces to visualize, you can use the [Loki query editor]({{< relref "../../loki#loki-query-editor" >}}).
For results, you must configure [derived fields]({{< relref "../../loki#configure-derived-fields" >}}) in the Loki data source that point to this data source.

{{< figure src="/static/img/docs/tempo/query-editor-search.png" class="docs-image--no-shadow" max-width="750px" caption="Screenshot of the Tempo query editor showing the search tab" >}}

## Trace ID search

**To query a particular trace:**

1. Select the **TraceID** query type.
1. Enter the trace's ID into the **Trace ID** field.

{{< figure src="/static/img/docs/tempo/query-editor-traceid.png" class="docs-image--no-shadow" max-width="750px" caption="Screenshot of the Tempo TraceID query type" >}}
