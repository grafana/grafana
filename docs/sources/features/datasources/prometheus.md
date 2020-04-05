+++
title = "Using Prometheus in Grafana"
description = "Guide for using Prometheus in Grafana"
keywords = ["grafana", "prometheus", "guide"]
type = "docs"
aliases = ["/docs/grafana/latest/datasources/prometheus"]
[menu.docs]
name = "Prometheus"
parent = "datasources"
weight = 1
+++

# Using Prometheus in Grafana

Grafana includes built-in support for Prometheus.

## Adding the data source

1. Open the side menu by clicking the Grafana icon in the top header.
2. In the side menu under the `Dashboards` link you should find a link named `Data Sources`.
3. Click the `+ Add data source` button in the top header.
4. Select `Prometheus` from the _Type_ dropdown.

> NOTE: If you're not seeing the `Data Sources` link in your side menu it means that your current user does not have the `Admin` role for the current organization.

## Data source options

| Name                      | Description                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| _Name_                    | The data source name. This is how you refer to the data source in panels and queries.                                                 |
| _Default_                 | Default data source means that it will be pre-selected for new panels.                                                                |
| _Url_                     | The URL of your Prometheus server, e.g. `http://prometheus.example.org:9090`.                                                         |
| _Access_                  | Server (default) = URL needs to be accessible from the Grafana backend/server, Browser = URL needs to be accessible from the browser. |
| _Basic Auth_              | Enable basic authentication to the Prometheus data source.                                                                            |
| _User_                    | User name for basic authentication.                                                                                                   |
| _Password_                | Password for basic authentication.                                                                                                    |
| _Scrape interval_         | Set this to the typical scrape and evaluation interval configured in Prometheus. Defaults to 15s.                                     |
| _Custom Query Parameters_ | Add custom parameters to the Prometheus query URL. For example `timeout`, `partial_response`, `dedup` or `max_source_resolution`. Multiple parameters should be concatenated together with an '&amp;'. |

## Query editor

Open a graph in edit mode by click the title > Edit (or by pressing `e` key while hovering over panel).

{{< docs-imagebox img="/img/docs/v45/prometheus_query_editor_still.png"
                  animated-gif="/img/docs/v45/prometheus_query_editor.gif" >}}

| Name               | Description                                                                                                                                                                                                                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _Query expression_ | Prometheus query expression, check out the [Prometheus documentation](http://prometheus.io/docs/querying/basics/).                                                                                                                                                                                                                  |
| _Legend format_    | Controls the name of the time series, using name or pattern. For example `{{hostname}}` will be replaced with label value for the label `hostname`.                                                                                                                                                                                 |
| _Min step_         | An additional lower limit for the [`step` parameter of Prometheus range queries](https://prometheus.io/docs/prometheus/latest/querying/api/#range-queries) and for the `$__interval` variable. The limit is absolute and not modified by the _Resolution_ setting.                                                                  |
| _Resolution_       | `1/1` sets both the `$__interval` variable and the [`step` parameter of Prometheus range queries](https://prometheus.io/docs/prometheus/latest/querying/api/#range-queries) such that each pixel corresponds to one data point. For better performance, lower resolutions can be picked. `1/2` only retrieves a data point for every other pixel, and `1/10` retrieves one data point per 10 pixels. Note that both _Min time interval_ and _Min step_ limit the final value of `$__interval` and `step`. |
| _Metric lookup_    | Search for metric names in this input field.                                                                                                                                                                                                                                                                                        |
| _Format as_        | Switch between `Table`, `Time series` or `Heatmap`. `Table` will only work in the Table panel. `Heatmap` is suitable for displaying metrics of the Histogram type on a Heatmap panel. Under the hood, it converts cumulative histograms to regular ones and sorts series by the bucket bound.                                       |
| _Instant_          | Perform an "instant" query, to return only the latest value that Prometheus has scraped for the requested time series. Instant queries return results much faster than normal range queries. Use them to look up label sets.                                                                                                        |
| _Min time interval_| This value multiplied by the denominator from the _Resolution_ setting sets a lower limit to both the `$__interval` variable and the [`step` parameter of Prometheus range queries](https://prometheus.io/docs/prometheus/latest/querying/api/#range-queries). Defaults to _Scrape interval_ as set in the data source options.     |

> NOTE: Grafana slightly modifies the request dates for queries to align them with the dynamically calculated step.
> This ensures consistent display of metrics data but can result in a small gap of data at the right edge of a graph.

### Instant queries

The Prometheus datasource allows you to run "instant" queries, which queries only the latest value.
You can visualize the results in a table panel to see all available labels of a timeseries.

Instant query results are made up only of one datapoint per series but can be shown in the graph panel with the help of [series overrides]({{< relref "../panels/graph/#series-overrides" >}}).
To show them in the graph as a latest value point, add a series override and select `Points > true`.
To show a horizontal line across the whole graph, add a series override and select `Transform > constant`.

> Support for constant series overrides is available from Grafana v6.4

## Templating

Instead of hard-coding things like server, application and sensor name in your metric queries, you can use variables in their place.
Variables are shown as dropdown select boxes at the top of the dashboard. These dropdowns makes it easy to change the data
being displayed in your dashboard.

Check out the [Templating]({{< relref "../../reference/templating.md" >}}) documentation for an introduction to the templating feature and the different
types of template variables.

### Query variable

Variable of the type _Query_ allows you to query Prometheus for a list of metrics, labels or label values. The Prometheus data source plugin
provides the following functions you can use in the `Query` input field.

| Name                             | Description                                                             |
| -------------------------------- | ----------------------------------------------------------------------- |
| _label_\__names()_               | Returns a list of label names.                                          |
| _label_\__values(label)_         | Returns a list of label values for the `label` in every metric.         |
| _label_\__values(metric, label)_ | Returns a list of label values for the `label` in the specified metric. |
| _metrics(metric)_                | Returns a list of metrics matching the specified `metric` regex.        |
| _query_\__result(query)_         | Returns a list of Prometheus query result for the `query`.              |

For details of _metric names_, _label names_ and _label values_ are please refer to the [Prometheus documentation](http://prometheus.io/docs/concepts/data_model/#metric-names-and-labels).

#### Using interval and range variables

> Support for `$__range`, `$__range_s` and `$__range_ms` only available from Grafana v5.3

It's possible to use some global built-in variables in query variables; `$__interval`, `$__interval_ms`, `$__range`, `$__range_s` and `$__range_ms`, see [Global built-in variables]({{< relref "../../reference/templating/#global-built-in-variables" >}}) for more information. These can be convenient to use in conjunction with the `query_result` function when you need to filter variable queries since
`label_values` function doesn't support queries.

Make sure to set the variable's `refresh` trigger to be `On Time Range Change` to get the correct instances when changing the time range on the dashboard.

**Example usage:**

Populate a variable with the the busiest 5 request instances based on average QPS over the time range shown in the dashboard:

```
Query: query_result(topk(5, sum(rate(http_requests_total[$__range])) by (instance)))
Regex: /"([^"]+)"/
```

Populate a variable with the instances having a certain state over the time range shown in the dashboard, using `$__range_s`:

```
Query: query_result(max_over_time(<metric>[${__range_s}s]) != <state>)
Regex:
```

### Using variables in queries

There are two syntaxes:

- `$<varname>` Example: rate(http_requests_total{job=~"\$job"}[5m])
- `[[varname]]` Example: rate(http_requests_total{job=~"[[job]]"}[5m])

Why two ways? The first syntax is easier to read and write but does not allow you to use a variable in the middle of a word. When the _Multi-value_ or _Include all value_
options are enabled, Grafana converts the labels from plain text to a regex compatible string. Which means you have to use `=~` instead of `=`.

## Annotations

[Annotations]({{< relref "../../reference/annotations.md" >}}) allows you to overlay rich event information on top of graphs. You add annotation
queries via the Dashboard menu / Annotations view.

Prometheus supports two ways to query annotations.

- A regular metric query
- A Prometheus query for pending and firing alerts (for details see [Inspecting alerts during runtime](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/#inspecting-alerts-during-runtime))

The step option is useful to limit the number of events returned from your query.

## Getting Grafana metrics into Prometheus

Since 4.6.0 Grafana exposes metrics for Prometheus on the `/metrics` endpoint. We also bundle a dashboard within Grafana so you can get started viewing your metrics faster. You can import the bundled dashboard by going to the data source edit page and click the dashboard tab. There you can find a dashboard for Grafana and one for Prometheus. Import and start viewing all the metrics!

## Configure the data source with provisioning

It's now possible to configure data sources using config files with Grafana's provisioning system. You can read more about how it works and all the settings you can set for data sources on the [provisioning docs page]({{< relref "../../administration/provisioning/#datasources" >}})

Here are some provisioning examples for this data source.

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://localhost:9090
```
