+++
title = "Using Prometheus in Grafana"
description = "Guide for using Prometheus in Grafana"
keywords = ["grafana", "prometheus", "guide"]
type = "docs"
aliases = ["/datasources/prometheus"]
[menu.docs]
name = "Prometheus"
parent = "datasources"
weight = 2
+++

# Using Prometheus in Grafana

Grafana includes built-in support for Prometheus.

## Adding the data source to Grafana

1. Open the side menu by clicking the Grafana icon in the top header.
2. In the side menu under the `Dashboards` link you should find a link named `Data Sources`.
3. Click the `+ Add data source` button in the top header.
4. Select `Prometheus` from the *Type* dropdown.

> NOTE: If you're not seeing the `Data Sources` link in your side menu it means that your current user does not have the `Admin` role for the current organization.

## Data source options

Name | Description
------------ | -------------
*Name* | The data source name. This is how you refer to the data source in panels & queries.
*Default* | Default data source means that it will be pre-selected for new panels.
*Url* | The http protocol, ip and port of you Prometheus server (default port is usually 9090)
*Access* | Proxy = access via Grafana backend, Direct = access directly from browser.
*Basic Auth* | Enable basic authentication to the Prometheus data source.
*User* | Name of your Prometheus user
*Password* | Database user's password

## Query editor

Open a graph in edit mode by click the title > Edit (or by pressing `e` key while hovering over panel).

{{< docs-imagebox img="/img/docs/v45/prometheus_query_editor_still.png"
                  animated-gif="/img/docs/v45/prometheus_query_editor.gif" >}}

Name | Description
------- | --------
*Query expression* | Prometheus query expression, check out the [Prometheus documentation](http://prometheus.io/docs/querying/basics/).
*Legend format* | Controls the name of the time series, using name or pattern. For example `{{hostname}}` will be replaced with label value for the label `hostname`.
*Min step* | Set a lower limit for the Prometheus step option. Step controls how big the jumps are when the Prometheus query engine performs range queries. Sadly there is no official prometheus documentation to link to for this very important option.
*Resolution* | Controls the step option. Small steps create high-resolution graphs but can be slow over larger time ranges, lowering the resolution can speed things up. `1/2` will try to set step option to generate 1 data point for every other pixel. A value of `1/10` will try to set step option so there is a data point every 10 pixels.
*Metric lookup* | Search for metric names in this input field.
*Format as* | **(New in v4.3)** Switch between Table & Time series. Table format will only work in the Table panel.

## Templating

Instead of hard-coding things like server, application and sensor name in you metric queries you can use variables in their place.
Variables are shown as dropdown select boxes at the top of the dashboard. These dropdowns makes it easy to change the data
being displayed in your dashboard.

Checkout the [Templating]({{< relref "reference/templating.md" >}}) documentation for an introduction to the templating feature and the different
types of template variables.

### Query variable

Variable of the type *Query* allows you to query Prometheus for a list of metrics, labels or label values. The Prometheus data source plugin
provides the following functions you can use in the `Query` input field.

Name | Description
---- | --------
*label_values(label)* | Returns a list of label values for the `label` in every metric.
*label_values(metric, label)* | Returns a list of label values for the `label` in the specified metric.
*metrics(metric)* | Returns a list of metrics matching the specified `metric` regex.
*query_result(query)* | Returns a list of Prometheus query result for the `query`.

For details of *metric names*, *label names* and *label values* are please refer to the [Prometheus documentation](http://prometheus.io/docs/concepts/data_model/#metric-names-and-labels).

### Using variables in queries

There are two syntaxes:

- `$<varname>`  Example: rate(http_requests_total{job=~"$job"}[5m])
- `[[varname]]` Example: rate(http_requests_total{job=~"[[job]]"}[5m])

Why two ways? The first syntax is easier to read and write but does not allow you to use a variable in the middle of a word. When the *Multi-value* or *Include all value*
options are enabled, Grafana converts the labels from plain text to a regex compatible string. Which means you have to use `=~` instead of `=`.

## Annotations

[Annotations]({{< relref "reference/annotations.md" >}}) allows you to overlay rich event information on top of graphs. You add annotation
queries via the Dashboard menu / Annotations view.

Prometheus supports two ways to query annotations.

- A regular metric query
- A Prometheus query for pending and firing alerts (for details see [Inspecting alerts during runtime](https://prometheus.io/docs/alerting/rules/#inspecting-alerts-during-runtime))

The step option is useful to limit the number of events returned from your query.
