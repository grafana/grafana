+++
title = "Variables syntax and types"
keywords = ["grafana", "templating", "documentation", "guide", "template", "variable"]
type = "docs"
aliases = ["/docs/grafana/latest/reference/templating"]
[menu.docs]
identifier = "variables-syntax-types"
parent = "variables"
weight = 100
+++

# Variable syntax and types

Panel titles and metric queries can refer to variables using two different syntaxes:

- `$varname`
  This syntax is easy to read, but it does not allow you to use a variable in the middle of a word.
  **Example:** apps.frontend.$server.requests.count
- `${var_name}` Use this syntax when you want to interpolate a variable in the middle of an expression. 
- `${var_name:<format>}` This format gives you more control over how Grafana interpolates values. Refer to [Advanced variable format options]({{< relref "advanced-variable-format-options.md" >}}) for more detail on all the formatting types.
- `[[varname]]` Do not use. Deprecated old syntax, will be removed in a future release. 

Before queries are sent to your data source the query is _interpolated_, meaning the variable is replaced with its current value. During
interpolation, the variable value might be _escaped_ in order to conform to the syntax of the query language and where it is used.
For example, a variable used in a regex expression in an InfluxDB or Prometheus query will be regex escaped. Read the data source specific
documentation topic for details on value escaping during interpolation.

For advanced syntax to override data source default formatting, refer to [Advanced variable format options]({{< relref "advanced-variable-format-options.md" >}}).

## Variable types

Grafana uses the following types of variables.

|  Variable type  | Description   |
|:---|:---|
| Query   | Query-generated list of values such as metric names, server names, sensor IDs, data centers, and so on. [Add a query variable]({{< relref "variable-types/add-query-variable.md" >}}).   |
| Custom   | Define the variable options manually using a comma-separated list. [Add a custom variable]({{< relref "variable-types/add-custom-variable.md" >}}).   |
| Text box   | Display a free text input field with an optional default value. [Add a text box variable]({{< relref "variable-types/add-text-box-variable.md" >}}).   |
| Constant   | Define a hidden constant. [Add a constant variable]({{< relref "variable-types/add-constant-variable.md" >}}).   |
| Data source   | Quickly change the data source for an entire dashboard. [Add a data source variable]({{< relref "variable-types/add-data-source-variable.md" >}}).   |
| Interval   | Interval variables represent time spans. [Add an interval variable]({{< relref "variable-types/add-interval-variable.md" >}}).   |
| Ad hoc filters   | Key/value filters that are automatically added to all metric queries for a data source (InfluxDB, Prometheus, and Elasticsearch only). [Add ad hoc filters]({{< relref "variable-types/add-ad-hoc-filters.md" >}}).   |
| Global variables   | Built-in variables that can be used in expressions in the query editor. Refer to [Global variables]({{< relref "variable-types/global-variables" >}}).   |
| Chained variables   | Variable queries can contain other variables. Refer to [Chained variables]({{< relref "variable-types/chained-variables.md" >}}).
