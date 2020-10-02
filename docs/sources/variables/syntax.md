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

# Variable syntax

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
