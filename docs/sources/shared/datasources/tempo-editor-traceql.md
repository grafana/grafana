---
headless: true
labels:
  products:
    - enterprise
    - oss
---

[//]: # 'This file documents the TraceQL query editor for the Tempo data source.'
[//]: # 'This shared file is included in these locations:'
[//]: # '/grafana/docs/sources/datasources/tempo/query-editor/traceql-editor.md'
[//]: # '/website/docs/grafana-cloud/data-configuration/traces/traces-query-editor.md'
[//]: # '/tempo/docs/sources/tempo/traceql/query_editor.md'
[//]: #
[//]: # 'If you make changes to this file, verify that the meaning and content are not changed in any place where the file is included.'
[//]: # 'Any links should be fully qualified and not relative: /docs/grafana/ instead of ../grafana/.'

<!-- # Write TraceQL queries using the query editor -->

Inspired by PromQL and LogQL, TraceQL is a query language designed for selecting traces.
TraceQL provides a method for formulating precise queries so you can zoom in to the data you need.
Query results are returned faster because the queries limit what is searched.

To learn more about how to query by TraceQL, refer to the [TraceQL documentation](https://grafana.com/docs/tempo/latest/traceql/).

The TraceQL query editor, located on the **Explore** > **TraceQL** tab in Grafana, lets you search by trace ID and write TraceQL queries using autocomplete.

![The TraceQL query editor](/media/docs/tempo/traceql/screenshot-traceql-query-editor-v10.png)

## Enable the query editor

This feature is automatically available in Grafana 10 (and newer) and Grafana Cloud.

To use the TraceQL query editor in self-hosted Grafana 9.3.2 and older, you need to [enable the `traceqlEditor` feature toggle](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/).

## Write TraceQL queries using the query editor

The Tempo data source’s TraceQL query editor helps you query and display traces from Tempo in **Explore**.

To access the query editor, follow these steps:

1. Sign into Grafana or Grafana Cloud.
1. Select your Tempo data source.
1. From the menu, choose **Explore** and select the **TraceQL** tab.
1. Start your query on the text line by entering `{`. For help with TraceQL syntax, refer to the [Construct a TraceQL query documentation](https://grafana.com/docs/tempo/latest/traceql/#construct-a-traceql-query).
1. Optional: Use the Time picker drop-down to change the time and range for the query (refer to the [documentation for instructions](https://grafana.com/docs/grafana/latest/dashboards/use-dashboards/#set-dashboard-time-range)).
1. Once you have finished your query, select **Run query**.

This video provides and example of creating a TraceQL query using the custom tag grouping.

{{< youtube id="fraepWra00Y" >}}

## Query by TraceID

To query a particular trace by its trace ID:

1. From the menu, choose **Explore**, select the desired Tempo data source, and navigate to the **TraceQL** tab.
1. Enter the trace ID into the query field. For example: `41928b92edf1cdbe0ba6594baee5ae9`
1. Click **Run query** or use the keyboard shortcut Shift + Enter.

![Search for a trace ID using the TraceQL query editor](/media/docs/tempo/traceql/screenshot-traceql-editor-traceID.png)

## Use autocomplete to write queries

You can use the query editor’s autocomplete suggestions to write queries.
The editor detects span sets to provide relevant autocomplete options.
It uses regular expressions (regex) to detect where it's inside a spanset and provide attribute names, scopes, intrinsic names, logic operators, or attribute values from Tempo's API, depending on what's expected for the current situation.

![Query editor showing the auto-complete feature](/media/docs/tempo/traceql/screenshot-traceql-query-editor-auto-complete-v10.png)

To create a query using autocomplete, follow these steps:

1. From the menu, choose **Explore**, select the desired Tempo data source, and navigate to the **TraceQL** tab.

1. Enter your query. As you type your query, autocomplete suggestions appear as a drop-down. Each letter you enter refines the autocomplete options to match.

1. Use your mouse or arrow keys to select any option you wish. When the desired option is highlighted, press Tab on your keyboard to add the selection to your query.

1. Once your query is complete, select **Run query**.

## View query results

Query results for both the editor and the builder are returned in a table. Selecting the Trace ID or Span ID provides more detailed information.

Selecting the trace ID from the returned results opens a trace diagram. Selecting a span from the returned results opens a trace diagram and reveals the relevant span in the trace diagram (the highlighted blue line).

In the trace diagram, the bold text on the left side of each span indicates the service name, for example `mythical-requester: requester`, and it is hidden when subsequent spans have the same service name (nested spans).
Each service has a color assigned to it, which is visible to the left of the name and timeline in the graph.
Spans with the same color belong to the same service. The grey text to the right of the service name indicates the span name.

![Query editor showing span results](/media/docs/tempo/traceql/screenshot-traceql-query-editor-results-v10.png)

### Streaming results

The Tempo data source supports streaming responses to TraceQL queries so you can see partial query results as they come in without waiting for the whole query to finish.

{{% admonition type="note" %}}
To use this feature in Grafana OSS v10.1 and later, enable the `traceQLStreaming` feature toggle. This capability is enabled by default in Grafana Cloud.
{{% /admonition %}}

Streaming is available for both the **Search** and **TraceQL** query types, and you'll get immediate visibility of incoming traces on the results table.

{{< video-embed src="/media/docs/grafana/data-sources/tempo-streaming-v2.mp4" >}}
