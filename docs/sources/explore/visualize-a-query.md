+++
title = "Visualize a Query"
keywords = ["explore", "loki", "logs", "visualization"]
weight = 10
+++

# Visualize a query

Once you've [added a query]({{< relref "add-a-query.md" >}}), you can use Explore to visualize and compare the query's results.

You can:

- [Split the view and compare multiple queries](#split-the-explore-view)
- [Visualize queries of log data sources](#visualize-logs)
- [Visualize queries of traces](#visualize-traces)

## Split the Explore view

The split view provides an easy way to compare graphs and tables side-by-side or to look at related data together on one page.

### Open a split view query

To open the split view, click the split button to duplicate the current query and split the page into two side-by-side queries.

{{< figure src="/static/img/docs/explore/explore_split-7-4.png" max-width= "950px" caption="Screenshot of Explore option in the panel menu" >}}

### Select a second data source

You can select a different data source for the new query. This allows you to compare the same query for two different sets of data, such as for different servers or between staging and production environments.

To select another data source for the split query, click the dropdown at the top left of the split view.

### Link timepickers across split views

In split view, you can link timepickers for both panels so that changes to one query's time range will also change the other's. This ensures that Explore displays the same time interval in both panels.

To link the timepickers, click one of the time-sync buttons attached to the timepickers.

### Close a split view query

To close the newly created query, click the Close Split button.

## Visualize logs

Results of log queries are shown as histograms in the graph and individual logs are explained in the following sections.

If the data source supports a full range log volume histogram, the graph with log distribution for all entered log queries is shown automatically. This feature is currently supported by Elasticsearch and Loki data sources.

If the data source does not support loading full range log volume histogram, the logs model computes a time series based on the log row counts bucketed by an automatically calculated time interval, and the first log row's timestamp then anchors the start of the histogram from the result. The end of the time series is anchored to the time picker's **To** range.

### Log level

For logs where a level label is specified, we use the value of the label to determine the log level and update color accordingly. If the log doesn't have a level label specified, we try to find out if its content matches any of the supported expressions (see below for more information). The log level is always determined by the first match. In case Grafana is not able to determine a log level, it will be visualized with an unknown log level.

> **Tip:** If you use Loki data source and the "level" is in your log-line, use parsers (JSON, logfmt, regex,..) to extract the level information into a level label that is used to determine log level. This will allow the histogram to show the various log levels in separate bars.

**Supported log levels and mapping of log level abbreviation and expressions:**

| Supported expressions | Log level |      Color |
| --------------------- | :-------: | ---------: |
| emerg                 | critical  |     purple |
| fatal                 | critical  |     purple |
| alert                 | critical  |     purple |
| crit                  | critical  |     purple |
| critical              | critical  |     purple |
| err                   |   error   |        red |
| eror                  |   error   |        red |
| error                 |   error   |        red |
| warn                  |  warning  |     yellow |
| warning               |  warning  |     yellow |
| info                  |   info    |      green |
| information           |   info    |      green |
| notice                |   info    |      green |
| dbug                  |   debug   |       blue |
| debug                 |   debug   |       blue |
| trace                 |   trace   | light blue |
| \*                    |  unknown  |       grey |

## Navigating logs

Logs navigation next to the log lines can be used to request more logs. You can do this by clicking on Older logs button on the bottom of navigation. This is especially useful when you hit the line limit and you want to see more logs. Each request that is run from the navigation is then displayed in the navigation as separate page. Every page is showing from and to timestamp of the incoming log lines. You can see previous results by clicking on the page. Explore is caching last five requests run from the logs navigation, so you are not re-running the same queries when clicking on the pages.

![Navigate logs in Explore](/static/img/docs/explore/navigate-logs-8-0.png)

### Visualization options

You can customize how logs are displayed and select which columns are shown.

#### Time

Shows or hides the time column. This is the timestamp associated with the log line as reported from the data source.

#### Unique labels

Shows or hides the unique labels column that includes only non-common labels. All common labels are displayed above.

#### Wrap lines

Set this to True if you want the display to use line wrapping. If set to False, it will result in horizontal scrolling.

#### Prettify JSON

Set this to `true` to pretty print all JSON logs. This setting does not affect logs in any format other than JSON.

#### Deduping

Log data can be very repetitive and Explore can help by hiding duplicate log lines. There are a few different deduplication algorithms that you can use:

- **Exact -** Exact matches are done on the whole line except for date fields.
- **Numbers -** Matches on the line after stripping out numbers such as durations, IP addresses, and so on.
- **Signature -** The most aggressive deduping, this strips all letters and numbers and matches on the remaining whitespace and punctuation.

#### Flip results order

You can change the order of received logs from the default descending order (newest first) to ascending order (oldest first).

### Labels and detected fields

Each log row has an extendable area with its labels and detected fields, for more robust interaction. For all labels we have added the ability to filter for (positive filter) and filter out (negative filter) selected labels. Each field or label also has a stats icon to display ad-hoc statistics in relation to all displayed logs.

#### Derived fields links

By using Derived fields, you can turn any part of a log message into an internal or external link. The created link is visible as a button next to the Detected field in the Log details view.
{{< figure src="/static/img/docs/explore/detected-fields-link-7-4.png" max-width="800px" caption="Detected fields link in Explore" >}}

#### Toggle detected fields

> **Note:** Available in Grafana 7.2 and later versions.

If your logs are structured in `json` or `logfmt`, then you can show or hide detected fields. Expand a log line and then click the eye icon to show or hide fields.

{{< figure src="/static/img/docs/explore/parsed-fields-7-2.gif" max-width="800px" caption="Toggling detected fields in Explore" >}}

### Escaping newlines

Explore automatically detects some incorrectly escaped sequences in log lines, such as newlines (`\n`, `\r`) or tabs (`\t`). When it detects such sequences, Explore provides an "Escape newlines" option.

To automatically fix incorrectly escaped sequences that Explore has detected:

1. Click "Escape newlines" to replace the sequences.
1. Manually review the replacements to confirm their correctness.

Explore replaces these sequences. When it does so, the option will change from "Escape newlines" to "Remove escaping". Evaluate the changes as the parsing may not be accurate based on the input received. You can revert the replacements by clicking "Remove escaping".

### Loki-specific features

Explore's integrations include the Grafana Labs open source log aggregation system, [Loki](https://github.com/grafana/loki). Loki is designed to be very cost effective, as it does not index the contents of the logs, but rather a set of labels for each log stream. The logs from Loki are queried in a similar way to querying with label selectors in Prometheus. It uses labels to group log streams which can be made to match up with your Prometheus labels.

For more information about Grafana Loki, refer to [Grafana Loki](https://github.com/grafana/loki) or the Grafana Labs-hosted variant, [Grafana Cloud Logs](https://grafana.com/loki).

For more information on querying Loki for log data, refer to [Loki's data source documentation]({{< relref "../datasources/loki.md" >}}).

#### Switch from metrics to logs

If you switch from a Prometheus query to a logs query (you can do a split first to have your metrics and logs side by side), Explore will keep the labels from your query that exist in the logs and use those to query the log streams. For example, given the following Prometheus query:

`grafana_alerting_active_alerts{job="grafana"}`

After switching to the Logs data source, the query changes to:

`{job="grafana"}`

This will return logs in the selected time range that can be grepped or text searched.

#### Live log tailing

You can watch watch real-time logs on supported data sources, such as Loki, by switching to the live tail view.

To switch to the live tail view, click the **Live** button in the Explore toolbar.

While in live tail view, new log lines appear at the bottom of the screen, and older lines add a fading contrasting background so you can visually track which content is new.

To pause live log tailing and explore without interruption, either click the **Pause** button or scroll up in the logs view.

To resume live tailing, click the **Resume** button.

To stop live tailing, exit the live tail view, and return to the standard Explore view, click the **Stop** button.

{{< figure src="/static/img/docs/v64/explore_live_tailing.gif" class="docs-image--no-shadow" caption="Explore Live tailing in action" >}}

## Visualize traces

Since Grafana 7.0, Explore also allows you to visualize data from tracing data sources.

Explore supports visualizing traces from these data sources:

- [Jaeger]({{< relref "../datasources/jaeger.md" >}})
- [Tempo]({{< relref "../datasources/tempo.md" >}})
- [X-Ray](https://grafana.com/grafana/plugins/grafana-x-ray-datasource)
- [Zipkin]({{< relref "../datasources/zipkin.md" >}})

For information on how to configure queries for the data sources listed above, refer to the documentation for specific data source.

{{< figure src="/static/img/docs/explore/explore-trace-view-full-8-0.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the trace view" >}}

### Trace components

Explore provides several trace-specific visualization components.

#### Header

{{< figure src="/static/img/docs/v70/explore-trace-view-header.png" class="docs-image--no-shadow" max-width= "750px" caption="Screenshot of the trace view header" >}}

- Header title: Shows the name of the root span and trace ID.
- Search: Highlights spans containing the searched text.
- Metadata: Various metadata about the trace.

#### Minimap

{{< figure src="/static/img/docs/v70/explore-trace-view-minimap.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the trace view minimap" >}}

Shows a condensed view of the trace timeline. Drag your mouse over the minimap to zoom into smaller time range. Zooming will also update the main timeline, so it is easy to see shorter spans. Hovering over the minimap, when zoomed, will show Reset Selection button which resets the zoom.

#### Timeline

{{< figure src="/static/img/docs/v70/explore-trace-view-timeline.png" class="docs-image--no-shadow" max-width= "900px"  caption="Screenshot of the trace view timeline" >}}

Shows list of spans within the trace. Each span row consists of these components:

- Expand children button: Expands or collapses all the children spans of selected span.
- Service name: Name of the service logged the span.
- Operation name: Name of the operation that this span represents.
- Span duration bar: Visual representation of the operation duration within the trace.

Clicking anywhere on the span row shows span details.

#### Span details

{{< figure src="/static/img/docs/v70/explore-trace-view-span-details.png" class="docs-image--no-shadow" max-width= "900px"  caption="Screenshot of the trace view span details" >}}

- Operation name
- Span metadata
- Tags: Any tags associated with this span.
- Process metadata: Metadata about the process that logged this span.
- Logs: List of logs logged by this span and associated key values. In case of Zipkin logs section shows Zipkin annotations.

#### Node graph

You can optionally expand the node graph for the displayed trace. Depending on the data source, this can show spans of the trace as nodes in the graph, or as some additional context like service graph based on the current trace.

![Node graph](/static/img/docs/explore/explore-trace-view-node-graph-8-0.png 'Node graph')

#### Trace to logs

> **Note:** Available in Grafana 7.4 and later versions.

You can navigate from a span in a trace view directly to logs relevant for that span. This is available for Tempo, Jaeger, and Zipkin data sources at this moment. Refer to their relevant documentation for instructions on how to configure this feature.

{{< figure src="/static/img/docs/explore/trace-to-log-7-4.png" class="docs-image--no-shadow" max-width= "600px"  caption="Screenshot of the trace view in Explore with icon next to the spans" >}}

Click the document icon to open a split view in Explore with the configured data source and query relevant logs for the span.

### Data API

Trace visualizations need a specific shape of the data to be returned from the data source in order to correctly display them.

The data source must return a data frame and set `frame.meta.preferredVisualisationType = 'trace'`.

#### Data frame structure

Required fields:

| Field name   | Type                | Description                                                                                                                         |
| ------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| traceID      | string              | Identifier for the entire trace. There should be only one trace in the data frame.                                                  |
| spanID       | string              | Identifier for the current span. SpanIDs should be unique per trace.                                                                |
| parentSpanID | string              | SpanID of the parent span to create child parent relationship in the trace view. Can be `undefined` for root span without a parent. |
| serviceName  | string              | Name of the service this span is part of.                                                                                           |
| serviceTags  | TraceKeyValuePair[] | List of tags relevant for the service.                                                                                              |
| startTime    | number              | Start time of the span in millisecond epoch time.                                                                                   |
| duration     | number              | Duration of the span in milliseconds.                                                                                               |

Optional fields:

| Field name     | Type                | Description                                                        |
| -------------- | ------------------- | ------------------------------------------------------------------ |
| logs           | TraceLog[]          | List of logs associated with the current span.                     |
| tags           | TraceKeyValuePair[] | List of tags associated with the current span.                     |
| warnings       | string[]            | List of warnings associated with the current span.                 |
| stackTraces    | string[]            | List of stack traces associated with the current span.             |
| errorIconColor | string              | Color of the error icon in case span is tagged with `error: true`. |

For details about the types, see [TraceSpanRow](https://grafana.com/docs/grafana/latest/packages_api/data/tracespanrow/), [TraceKeyValuePair](https://grafana.com/docs/grafana/latest/packages_api/data/tracekeyvaluepair/) and [TraceLog](https://grafana.com/docs/grafana/latest/packages_api/data/tracelog/)
