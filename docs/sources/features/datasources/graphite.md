+++
title = "Using Graphite in Grafana"
description = "Guide for using graphite in Grafana"
keywords = ["grafana", "graphite", "guide"]
type = "docs"
aliases = ["/docs/grafana/latest/datasources/graphite"]
[menu.docs]
name = "Graphite"
identifier = "graphite"
parent = "datasources"
weight = 1
+++

# Using Graphite in Grafana

Grafana has an advanced Graphite query editor that lets you quickly navigate the metric space, add functions,
change function parameters and much more. The editor can handle all types of graphite queries. It can even handle complex nested
queries through the use of query references.

Refer to [Add a data source]({{< relref "add-a-data-source.md" >}}) for instructions on how to add a data source to Grafana. Only organization admins can add data sources.

## Graphite settings

To access Graphite settings, hover your mouse over the **Configuration** (gear) icon, then click **Data Sources**, and then click the Graphite data source.

Name | Description
------------ | -------------
Name | The data source name. This is how you refer to the data source in panels and queries.
Default | Default data source means that it will be pre-selected for new panels.
URL | The HTTP protocol, IP, and port of your graphite-web or graphite-api install.
Access | Server (default) = URL needs to be accessible from the Grafana backend/server, Browser = URL needs to be accessible from the browser.
Auth | Refer to [Authentication]({{< relref "../../auth/_index.md" >}}) for more information.
Basic Auth  | Enable basic authentication to the data source.
User | User name for basic authentication.
Password | Password for basic authentication.
Custom HTTP Headers | Click **Add header** to add a custom HTTP header.
Header | Enter the custom header name.
Value |  Enter the custom header value.
Graphite details | 
Version | Select your version of Graphite.
Type | Select your type of Graphite.

Access mode controls how requests to the data source will be handled. Server should be the preferred way if nothing else is stated.

### Server access mode (default)

All requests will be made from the browser to Grafana backend/server which in turn will forward the requests to the data source and by that circumvent possible Cross-Origin Resource Sharing (CORS) requirements. The URL needs to be accessible from the Grafana backend/server if you select this access mode.

### Browser access mode

All requests will be made from the browser directly to the data source and may be subject to Cross-Origin Resource Sharing (CORS) requirements. The URL needs to be accessible from the browser if you select this access mode.

## Graphite query editor

Grafana includes a Graphite-specific query editor to help you build your queries.

To see the raw text of the query that is sent to Graphite, click the **Toggle text edit mode** (pencil) icon.

### Choose metrics to query

Click **Select metric** to start navigating the metric space. Once you start, you can continue using the mouse or keyboard arrow keys. You can select a wildcard and still continue.

{{< docs-imagebox img="/img/docs/graphite/graphite-query-editor-still.png"
                  animated-gif="/img/docs/graphite/graphite-query-editor.gif" >}}

### Functions

Click the plus icon next to **Function** to add a function. You can search for the function or select it from the menu. Once
a function is selected, it will be added and your focus will be in the text box of the first parameter.
- To edit or change a parameter, click on it and it will turn into a text box.
- To delete a function, click the function name followed by the x icon.

{{< docs-imagebox img="/img/docs/graphite/graphite-functions-still.png"
                  animated-gif="/img/docs/graphite/graphite-functions-demo.gif" >}}

Some functions like aliasByNode support an optional second argument. To add an argument, hover your mouse over the first argument and then click the `+` symbol that appears. To remove the second optional parameter, click on it and leave it blank and the editor will remove it.

### Sort labels

If you want consistent ordering, use sortByName. This can be particularly annoying when you have the same labels on multiple graphs, and they are both sorted differently and using different colors. To fix this, use `sortByName()`.

### Nested queries

You can reference queries by the row “letter” that they’re on (similar to  Microsoft Excel). If you add a second query to a graph, you can reference the first query simply by typing in #A. This provides an easy and convenient way to build compounded queries.

### Avoiding many queries by using wildcards

Occasionally one would like to see multiple time series plotted on the same graph. For example we might want to see how the CPU is being utilized on a machine. You might
initially create the graph by adding a query for each time series, such as `cpu.percent.user.g`,
`cpu.percent.system.g`, and so on.  This results in *n* queries made to the data source, which is inefficient.

To be more efficient one can use wildcards in your search, returning all the time series in one query. For example, `cpu.percent.*.g`.

### Modify the metric name in my tables or charts

Use `alias` functions to change metric names on Grafana tables or graphs For example `aliasByNode()` or `aliasSub()`.

## Point consolidation

All Graphite metrics are consolidated so that Graphite doesn't return more data points than there are pixels in the graph. By default,
this consolidation is done using `avg` function. You can control how Graphite consolidates metrics by adding the Graphite consolidateBy function.

> **Note:** This means that legend summary values (max, min, total) cannot all be correct at the same time. They are calculated
> client-side by Grafana. And depending on your consolidation function, only one or two can be correct at the same time.

## Combine time series

To combine time series, click **Combine** in the **Functions** list.

## Data exploration and tags

In Graphite, _everything_ is a tag.

When exploring data, previously-selected tags are used to filter the remaining result set. To select data, you use the
`seriesByTag` function, which takes tag expressions (`=`, `!=`, `=~`, `!=~`) to filter timeseries.

The Grafana query builder does this for you automatically when you select a tag.

> **Tip:** The regular expression search can be quite slow on high-cardinality tags, so try to use other tags to reduce the scope first.
Starting off with a particular name/namespace can help reduce the results.

## Template variables

Instead of hard-coding things like server, application, and sensor name in your metric queries, you can use variables in their place.
Variables are shown as drop-down select boxes at the top of the dashboard. These dropdowns make it easy to change the data
being displayed in your dashboard.

For more information, refer to [Variables and templates]({{< relref "../../variables/templates-and-variables.md" >}}).

Graphite 1.1 introduced tags and Grafana added support for Graphite queries with tags in version 5.0. To create a variable using tag values, use the Grafana functions `tags` and `tag_values`.

Query | Description
------------ | -------------
tags() | Returns all tags.
tags(server=~backend\*) | Returns only tags that occur in series matching the filter expression.
tag_values(server)  | Return tag values for the specified tag.
tag_values(server, server=~backend\*)  | Returns filtered tag values that occur for the specified tag in series matching those expressions.
tag_values(server, server=~backend\*, app=~${apps:regex}) | Multiple filter expressions and expressions can contain other variables.

For more details, see the [Graphite docs on the autocomplete API for tags](http://graphite.readthedocs.io/en/latest/tags.html#auto-complete-support).

### Query variable

The query you specify in the query field should be a metric find type of query. For example, a query like `prod.servers.*` will fill the
variable with all possible values that exist in the wildcard position.

You can also create nested variables that use other variables in their definition. For example
`apps.$app.servers.*` uses the variable `$app` in its query definition.

#### Using `__searchFilter` to filter query variable results
> Available from Grafana 6.5 and above

Using `__searchFilter` in the query field will filter the query result based on what the user types in the dropdown select box.
When nothing has been entered by the user the default value for `__searchFilter` is `*` and `` when used as part of a regular expression.

The example below shows how to use `__searchFilter` as part of the query field to enable searching for `server` while the user types in the dropdown select box.

Query
```bash
apps.$app.servers.$__searchFilter
```

TagValues
```bash
tag_values(server, server=~${__searchFilter:regex})
```

### Variable usage

You can use a variable in a metric node path or as a parameter to a function.
![variable](/img/docs/v2/templated_variable_parameter.png)

There are two syntaxes:

- `$<varname>`  Example: apps.frontend.$server.requests.count
- `${varname}` Example: apps.frontend.${server}.requests.count

Why two ways? The first syntax is easier to read and write but does not allow you to use a variable in the middle of a word. Use
the second syntax in expressions like  `my.server${serverNumber}.count`.

Example:
[Graphite Templated Dashboard](https://play.grafana.org/dashboard/db/graphite-templated-nested)

### Variable usage in tag queries

Multi-value variables in tag queries use the advanced formatting syntax introduced in Grafana 5.0 for variables: `{var:regex}`. Non-tag queries will use the default glob formatting for multi-value variables.

Example of a tag expression with regex formatting and using the Equal Tilde operator, `=~`:

```text
server=~${servers:regex}
```

For more information, refer to [Advanced variable format options]({{< relref "../../variables/advanced-variable-format-options.md" >}}).

## Annotations

[Annotations]({{< relref "../../dashboards/annotations.md" >}}) allow you to overlay rich event information on top of graphs. You add annotation
queries via the Dashboard menu / Annotations view.

Graphite supports two ways to query annotations. A regular metric query, for this you use the `Graphite query` textbox. A Graphite events query, use the `Graphite event tags` textbox,
specify a tag or wildcard (leave empty should also work)

## Get Grafana metrics into Graphite

Grafana exposes metrics for Graphite on the `/metrics` endpoint. For detailed instructions, refer to [Internal Grafana metrics]({{< relref "../../administration/metrics.md">}}).

## Configure the data source with provisioning

It's now possible to configure data sources using config files with Grafana's provisioning system. You can read more about how it works and all the settings you can set for data sources on the [provisioning docs page]({{< relref "../../administration/provisioning/#datasources" >}})

Here are some provisioning examples for this data source.

```yaml
apiVersion: 1

datasources:
  - name: Graphite
    type: graphite
    access: proxy
    url: http://localhost:8080
    jsonData:
      graphiteVersion: "1.1"
```
