+++
title = "Add a query"
keywords = ["explore", "loki", "logs"]
weight = 5
+++

# Add a query

Once you've [accessed Explore]({{< relref "access-explore.md" >}}), you can use it to examine and compare data from sources via queries.

## Populate Explore with data

To query data, you must first select a data source. In addition to querying metrics sources, you can also query certain supported log and trace sources.

To select a data source, choose one from the dropdown in the top left. [Prometheus](https://grafana.com/oss/prometheus/) has a custom Explore implementation, while other data sources use their standard query editor.

## Query a data source

To query a data source, enter your query in the query field.

There are three buttons beside the query field: a clear button (X), an add query button (+), and the remove query button (-). Just like the normal query editor, you can add and remove multiple queries.

Once you've entered a query, you can use Explore to:

- [Visualize the results]({{< relref "visualize-a-query.md" >}})
- [Inspect and troubleshoot the query and its results]({{< relref ="inspect-a-query.md" >}})
- [Manage multiple queries]({{< relref "manage-queries.md" >}})
- [Share the query]){{< relref "share-a-query.md" >}}

### Prometheus-specific features

Explore features a custom querying experience for Prometheus. When you execute a query, Explore actually executes two queries: a normal Prometheus query for the graph, and an Instant Query for the table. An Instant Query returns the last value for each time series, which summarizes the data shown in the graph.

#### Metrics explorer

On the left side of the query field, click **Metrics** to open the Metric Explorer. This shows a hierarchical menu with metrics grouped by their prefix. For example, all Alertmanager metrics are grouped under the `alertmanager` prefix. This is a good starting point if you just want to explore which metrics are available.

{{< figure src="/static/img/docs/v65/explore_metric_explorer.png" class="docs-image--no-shadow" max-width= "800px" caption="Screenshot of the new Explore option in the panel menu" >}}

#### Query field

The Query field supports autocomplete for metric names, function and works mostly the same way as the standard Prometheus query editor. Press the enter key to execute a query.

The autocomplete menu can be triggered by pressing Ctrl+Space. The Autocomplete menu contains a new History section with a list of recently executed queries.

Suggestions can appear under the query field - click on them to update your query with the suggested change.

- For counters (monotonically increasing metrics), a rate function will be suggested.
- For buckets, a histogram function will be suggested.
- For recording rules, possible to expand the rules.

#### Table filters

To add filters to the query expression, click the filter button in the "label" column of a Table panel. You can filter multiple queries; each filter is added for all the queries.

## Query logs

Explore allows you to analyze logs using the following data sources:

- [Elasticsearch]({{< relref "../datasources/elasticsearch.md" >}})
- [InfluxDB]({{< relref "../datasources/influxdb/_index.md" >}})
- [Loki]({{< relref "../datasources/loki.md" >}})

During an infrastructure monitoring and incident response, you can dig deeper into the metrics and logs to find the cause. Explore also allows you to correlate metrics and logs by viewing them side-by-side. This creates a new debugging workflow:

1. Receive an alert.
1. Drill down and examine metrics.
1. Drill down again and search logs related to the metric and time interval (and in the future, distributed traces).

For details about visualizing and comparing logs in Explore, see [Visualize a Query]({{< relref "visualize-a-query.md" >}}).

## Query traces

Since Grafana 7.0, Explore allows you to analyze traces using the following data sources:

- [Jaeger]({{< relref "../datasources/jaeger.md" >}})
- [Tempo]({{< relref "../datasources/tempo.md" >}})
- [X-Ray](https://grafana.com/grafana/plugins/grafana-x-ray-datasource)
- [Zipkin]({{< relref "../datasources/zipkin.md" >}})

For information on how to configure queries for the data sources listed above, refer to the documentation for specific data source.

{{< figure src="/static/img/docs/explore/explore-trace-view-full-8-0.png" class="docs-image--no-shadow" max-width= "900px" caption="Screenshot of the trace view" >}}

For details about visualizing and comparing traces in Explore, see [Visualize a Query]({{< relref "visualize-a-query.md" >}}).
