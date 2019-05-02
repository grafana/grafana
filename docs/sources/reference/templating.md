+++
title = "Variables"
keywords = ["grafana", "templating", "documentation", "guide", "template", "variable"]
type = "docs"
[menu.docs]
name = "Variables"
parent = "dashboard_features"
weight = 1
+++

# Variables

Variables allows for more interactive and dynamic dashboards. Instead of hard-coding things like server, application
and sensor name in your metric queries you can use variables in their place. Variables are shown as dropdown select boxes at the top of
the dashboard. These dropdowns make it easy to change the data being displayed in your dashboard.

{{< docs-imagebox img="/img/docs/v50/variables_dashboard.png" >}}

## What is a variable?

A variable is a placeholder for a value. You can use variables in metric queries and in panel titles. So when you change
the value, using the dropdown at the top of the dashboard, your panel's metric queries will change to reflect the new value.

### Interpolation

Panel titles and metric queries can refer to variables using two different syntaxes:

- `$varname`  Example: apps.frontend.$server.requests.count
- `[[varname]]` Example: apps.frontend.[[server]].requests.count

Why two ways? The first syntax is easier to read and write but does not allow you to use a variable in the middle of word. Use
the second syntax in expressions like  `my.server[[serverNumber]].count`.

Before queries are sent to your data source the query is **interpolated**, meaning the variable is replaced with its current value. During
interpolation the variable value might be **escaped** in order to conform to the syntax of the query language and where it is used.
For example, a variable used in a regex expression in an InfluxDB or Prometheus query will be regex escaped. Read the data source specific
documentation article for details on value escaping during interpolation.

### Advanced Formatting Options

The formatting of the variable interpolation depends on the data source but there are some situations where you might want to change the default formatting. For example, the default for the MySql datasource is to join multiple values as comma-separated with quotes: `'server01','server02'`. In some cases you might want to have a comma-separated string without quotes: `server01,server02`. This is now possible with the advanced formatting options.

Syntax: `${var_name:option}`

#### Glob
Formats multi-value variable into a glob (for Graphite queries).

```bash
servers = ['test1', 'test2']
String to interpolate: '${servers:glob}'
Interpolation result: '{test1,test2}'
```

### Regex
Formats multi-value variable into a regex string.

```bash
servers = ['test1.', 'test2']
String to interpolate: '${servers:regex}'
Interpolation result: '(test1\.|test2)'
```

### Pipe
Formats multi-value variable into a pipe-separated string.

```bash
servers = ['test1.', 'test2']
String to interpolate: '${servers:pipe}'
Interpolation result: 'test1.|test2'
```

### Csv
Formats multi-value variable as a comma-separated string.

```bash
servers = ['test1', 'test2']
String to interpolate: '${servers:csv}'
Interpolation result: 'test1,test2'
```

### Json
Formats multi-value variable as a comma-separated string.

```bash
servers = ['test1', 'test2']
String to interpolate: '${servers:json}'
Interpolation result: '["test1", "test2"]'
```

### Distributed
Formats multi-value variable in custom format for OpenTSDB.

```bash
servers = ['test1', 'test2']
String to interpolate: '${servers:distributed}'
Interpolation result: 'test1,servers=test2'
```

### Lucene
Formats multi-value variable in lucene format for Elasticsearch.

```bash
servers = ['test1', 'test2']
String to interpolate: '${servers:lucene}'
Interpolation result: '("test1" OR "test2")'
```

### Percentencode
Formats single & multi valued variables for use in URL parameters.

```bash
servers = ['foo()bar BAZ', 'test2']
String to interpolate: '${servers:percentencode}'
Interpolation result: 'foo%28%29bar%20BAZ%2Ctest2'
```

Test the formatting options on the [Grafana Play site](http://play.grafana.org/d/cJtIfcWiz/template-variable-formatting-options?orgId=1).

If any invalid formatting option is specified, then `glob` is the default/fallback option.

An alternative syntax (that might be deprecated in the future) is `[[var_name:option]]`.

### Variable options

A variable is presented as a dropdown select box at the top of the dashboard. It has a current value and a set of **options**. The **options**
is the set of values you can choose from.

## Adding a variable

{{< docs-imagebox img="/img/docs/v50/variables_var_list.png" max-width="800px" >}}

You add variables via Dashboard cogs menu > Templating. This opens up a list of variables and a `New` button to create a new variable.

### Basic variable options

Option | Description
------- | --------
*Name* | The name of the variable, this is the name you use when you refer to your variable in your metric queries. Must be unique and contain no white-spaces.
*Label* | The name of the dropdown for this variable.
*Hide* | Options to hide the dropdown select box.
*Type* | Defines the variable type.


### Variable types

Type | Description
------- | --------
*Query* | This variable type allows you to write a data source query that usually returns a list of metric names, tag values or keys. For example, a query that returns a list of server names, sensor ids or data centers.
*Interval* | This variable can represent time spans. Instead of hard-coding a group by time or date histogram interval, use a variable of this type.
*Datasource* | This type allows you to quickly change the data source for an entire Dashboard. Useful if you have multiple instances of a data source in for example different environments.
*Custom* | Define the variable options manually using a comma separated list.
*Constant* | Define a hidden constant. Useful for metric path prefixes for dashboards you want to share. During dashboard export, constant variables will be made into an import option.
*Ad hoc filters* | Very special kind of variable that only works with some data sources, InfluxDB & Elasticsearch currently. It allows you to add key/value filters that will automatically be added to all metric queries that use the specified data source.
*Text box* | This variable type will display as a free text input field with an optional default value.

### Query options

This variable type is the most powerful and complex as it can dynamically fetch its options using a data source query.

Option | Description
------- | --------
*Data source* | The data source target for the query.
*Refresh* | Controls when to update the variable option list (values in the dropdown). **On Dashboard Load** will slow down dashboard load as the variable query needs to be completed before dashboard can be initialized. Set this only to **On Time Range Change** if your variable options query contains a time range filter or is dependent on dashboard time range.
*Query* | The data source specific query expression.
*Regex* | Regex to filter or capture specific parts of the names return by your data source query. Optional.
*Sort* | Define sort order for options in dropdown. **Disabled** means that the order of options returned by your data source query will be used.

#### Using regex to filter/modify values in the Variable dropdown

Using the Regex Query Option, you filter the list of options returned by the Variable query or modify the options returned.

Examples of filtering on the following list of options:

```text
backend_01
backend_02
backend_03
backend_04
```

##### Filter so that only the options that end with `01` or `02` are returned:

Regex:

```regex
/.*[01|02]/
```

Result:

```text
backend_01
backend_02
```

##### Filter and modify the options using a regex capture group to return part of the text:

Regex:

```regex
/.*(01|02)/
```

Result:

```text
01
02
```

#### Filter and modify - Prometheus Example

List of options:

```text
up{instance="demo.robustperception.io:9090",job="prometheus"} 1 1521630638000
up{instance="demo.robustperception.io:9093",job="alertmanager"} 1 1521630638000
up{instance="demo.robustperception.io:9100",job="node"} 1 1521630638000
```

Regex:

```regex
/.*instance="([^"]*).*/
```

Result:

```text
demo.robustperception.io:9090
demo.robustperception.io:9093
demo.robustperception.io:9100
```

### Query expressions

The query expressions are different for each data source.

- [Graphite templating queries]({{< relref "features/datasources/graphite.md#templating" >}})
- [Elasticsearch templating queries]({{< relref "features/datasources/elasticsearch.md#templating" >}})
- [InfluxDB templating queries]({{< relref "features/datasources/influxdb.md#templating" >}})
- [Prometheus templating queries]({{< relref "features/datasources/prometheus.md#templating" >}})
- [OpenTSDB templating queries]({{< relref "features/datasources/opentsdb.md#templating" >}})

One thing to note is that query expressions can contain references to other variables and in effect create linked variables.
Grafana will detect this and automatically refresh a variable when one of it's containing variables change.

## Selection Options

Option | Description
------- | --------
*Multi-value* | If enabled, the variable will support the selection of multiple options at the same time.
*Include All option* | Add a special `All` option whose value includes all options.
*Custom all value* | By default the `All` value will include all options in combined expression. This can become very long and can have performance problems. Many times it can be better to specify a custom all value, like a wildcard regex. To make it possible to have custom regex, globs or lucene syntax in the **Custom all value** option it is never escaped so you will have to think about what is a valid value for your data source.

### Formatting multiple values

Interpolating a variable with multiple values selected is tricky as it is not straight forward how to format the multiple values to into a string that
is valid in the given context where the variable is used. Grafana tries to solve this by allowing each data source plugin to
inform the templating interpolation engine what format to use for multiple values.

Note that the *Custom all value* option on the variable will have to be left blank for Grafana to format all values into a single string.

**Graphite**, for example, uses glob expressions. A variable with multiple values would, in this case, be interpolated as `{host1,host2,host3}` if
the current variable value was *host1*, *host2* and *host3*.

**InfluxDB and Prometheus** uses regex expressions, so the same variable
would be interpolated as `(host1|host2|host3)`. Every value would also be regex escaped if not, a value with a regex control character would
break the regex expression.

**Elasticsearch** uses lucene query syntax, so the same variable would, in this case, be formatted as `("host1" OR "host2" OR "host3")`. In this case every value
needs to be escaped so that the value can contain lucene control words and quotation marks.

#### Formatting troubles

Automatic escaping & formatting can cause problems and it can be tricky to grasp the logic is behind it.
Especially for InfluxDB and Prometheus where the use of regex syntax requires that the variable is used in regex operator context.
If you do not want Grafana to do this automatic regex escaping and formatting your only option is to disable the *Multi-value* or *Include All option*
options.

### Value groups/tags

If you have a lot of options in the dropdown for a multi-value variable. You can use this feature to group the values into selectable tags.

Option | Description
------- | --------
*Tags query* | Data source query that should return a list of tags
*Tag values query* | Data source query that should return a list of values for a specified tag key. Use `$tag` in the query to refer the currently selected tag.

{{< docs-imagebox img="/img/docs/v50/variable_dropdown_tags.png" max-width="300px" >}}

### Interval variables

Use the `Interval` type to create a variable that represents a time span (eg. `1m`,`1h`, `1d`). There is also a special `auto` option that will change depending on the current time range. You can specify how many times the current time range should be divided to calculate the current `auto` timespan.

This variable type is useful as a parameter to group by time (for InfluxDB), Date histogram interval (for Elasticsearch) or as a *summarize* function parameter (for Graphite).

Example using the template variable `myinterval` of type `Interval` in a graphite function:

```
summarize($myinterval, sum, false)
```

## Global Built-in Variables

Grafana has global built-in variables that can be used in expressions in the query editor.

### Time range variables

Grafana has two built in time range variables in `$__from` and `$__to`. They are currently always interpolated
as epoch milliseconds. These variables are only available in Grafana v6.0 and above.

### The $__interval Variable

This $__interval variable is similar to the `auto` interval variable that is described above. It can be used as a parameter to group by time (for InfluxDB, MySQL, Postgres, MSSQL), Date histogram interval (for Elasticsearch) or as a *summarize* function parameter (for Graphite).

Grafana automatically calculates an interval that can be used to group by time in queries. When there are more data points than can be shown on a graph then queries can be made more efficient by grouping by a larger interval. It is more efficient to group by 1 day than by 10s when looking at 3 months of data and the graph will look the same and the query will be faster. The `$__interval` is calculated using the time range and the width of the graph (the number of pixels).

Approximate Calculation: `(from - to) / resolution`

For example, when the time range is 1 hour and the graph is full screen, then the interval might be calculated to `2m` - points are grouped in 2 minute intervals. If the time range is 6 months and the graph is full screen, then the interval might be `1d` (1 day) - points are grouped by day.

In the InfluxDB data source, the legacy variable `$interval` is the same variable. `$__interval` should be used instead.

The InfluxDB and Elasticsearch data sources have `Group by time interval` fields that are used to hard code the interval or to set the minimum limit for the `$__interval` variable (by using the `>` syntax -> `>10m`).

### The $__interval_ms Variable

This variable is the `$__interval` variable in milliseconds (and not a time interval formatted string). For example, if the `$__interval` is `20m` then the `$__interval_ms` is `1200000`.

### The $timeFilter or $__timeFilter Variable

The `$timeFilter` variable returns the currently selected time range as an expression. For example, the time range interval `Last 7 days` expression is `time > now() - 7d`.

This is used in the WHERE clause for the InfluxDB data source. Grafana adds it automatically to InfluxDB queries when in Query Editor Mode. It has to be added manually in Text Editor Mode: `WHERE $timeFilter`.

The `$__timeFilter` is used in the MySQL data source.

### The $__name Variable

This variable is only available in the Singlestat panel and can be used in the prefix or suffix fields on the Options tab. The variable will be replaced with the series name or alias.

### The $__range Variable

> Only available in Grafana v5.3+

Currently only supported for Prometheus data sources. This variable represents the range for the current dashboard. It is calculated by `to - from`. It has a millisecond and a second representation called `$__range_ms` and `$__range_s`.

## Repeating Panels

Template variables can be very useful to dynamically change your queries across a whole dashboard. If you want
Grafana to dynamically create new panels or rows based on what values you have selected you can use the *Repeat* feature.

If you have a variable with `Multi-value` or `Include all value` options enabled you can choose one panel and have Grafana repeat that panel
for every selected value. You find the *Repeat* feature under the *General tab* in panel edit mode.

The `direction` controls how the panels will be arranged.

By choosing `horizontal` the panels will be arranged side-by-side. Grafana will automatically adjust the width
of each repeated panel so that the whole row is filled. Currently, you cannot mix other panels on a row with a repeated
panel.

Set `Max per row` to tell grafana how many panels per row you want at most. It defaults to *4* if you don't set anything.

By choosing `vertical` the panels will be arranged from top to bottom in a column. The width of the repeated panels will be the same as of the first panel (the original template) being repeated.

Only make changes to the first panel (the original template). To have the changes take effect on all panels you need to trigger a dynamic dashboard re-build.
You can do this by either changing the variable value (that is the basis for the repeat) or reload the dashboard.

## Repeating Rows

As seen above with the *Panels* you can also repeat *Rows* if you have variables set with  `Multi-value` or
`Include all value` selection option.

To enable this feature you need to first add a new *Row* using the *Add Panel* menu. Then by hovering the row title and
clicking on the cog button, you will access the `Row Options` configuration panel. You can then select the variable
you want to repeat the row for.

It may be a good idea to use a variable in the row title as well.

Example: [Repeated Rows Dashboard](http://play.grafana.org/dashboard/db/repeated-rows)

## URL state

Variable values are always synced to the URL using the syntax `var-<varname>=value`.

## Examples

- [Graphite Templated Dashboard](http://play.grafana.org/dashboard/db/graphite-templated-nested)
- [Elasticsearch Templated Dashboard](http://play.grafana.org/dashboard/db/elasticsearch-templated)
- [InfluxDB Templated Dashboard](http://play.grafana.org/dashboard/db/influxdb-templated-queries)
