+++
title = "Templating"
keywords = ["grafana", "templating", "documentation", "guide"]
type = "docs"
[menu.docs]
name = "Templating"
parent = "dashboard_features"
weight = 1
+++

# Templating

<img class="no-shadow" src="/img/docs/v4/templated_dash.png">

Templating allows you to make your dashboards more interactive and dynamic. They’re one of the more powerful and complex features in Grafana. The templating
feature allows you to create variables that are shown as dropdown select boxes at the top of the dashboard.
These dropdowns makes it easy to change the variable value and in turn quickly change the data being displayed.

## What is a variable?

A variable is a placeholder for a value. You can use variables in metric queries and in panel titles. So when you change
the value, using the dropdown at the top of the dashboard, your panel's metric queries will change to reflect the new value.

### Interpolation

Panel titles and metric queries can refer to variables using two different syntaxes:

- `$<varname>`  Example: apps.frontend.$server.requests.count
- `[[varname]]` Example: apps.frontend.[[server]].requests.count

Why two ways? The first syntax is easier to read and write but does not allow you to use a variable in the middle of word. Use
the second syntax for scenarios like this: `my.server[[serverNumber]].count`.

Before queries are sent to your data source the query is **interpolated**, meaning the variable is replaced with its current value. During
interpolation the variable value might be **escaped** in order to conform to the syntax of the query langauge of where it is used. For example
a variable used in a regex expression in an InfluxDB or Prometheus query will be regex escaped. Read the data source specific documentation
article for details on value escaping during interpolation.

## Variable types

<img class="no-shadow" src="/img/docs/v4/templating_var_list.png">

There are three different types of Template variables: query, custom, and interval.

They can all be used to create dynamic variables that you can use throughout the Dashboard, but they differ in how they get the data for their values.


### Query

 > Note: The Query type is Data Source specific. Please consult the appropriate documentation for your particular Data Source.

Query is the most common type of Template variable. Use the `Query` template type to generate a dynamic list of variables, simply by allowing Grafana to explore your Data Source metric namespace when the Dashboard loads.

For example a query like `prod.servers.*` will fill the variable with all possible values that exists in that wildcard position (in the case of the Graphite Data Source).

You can even create nested variables that use other variables in their definition. For example `apps.$app.servers.*` uses the variable $app in its own query definition.

You can utilize the special ** All ** value to allow the Dashboard user to query for every single Query variable returned. Grafana will automatically translate ** All ** into the appropriate format for your Data Source.

### Annotation query details

The annotation query options are different for each data source.

- [Graphite annotation queries]({{< relref "features/datasources/graphite.md#annotations" >}})
- [Elasticsearch annotation queries]({{< relref "features/datasources/elasticsearch.md#annotations" >}})
- [InfluxDB annotation queries]({{< relref "features/datasources/influxdb.md#annotations" >}})
- [Prometheus annotation queries]({{< relref "features/datasources/prometheus.md#annotations" >}})

#### Multi-select
As of Grafana 2.1, it is now possible to select a subset of Query Template variables (previously it was possible to select an individual value or 'All', not multiple values that were less than All). This is accomplished via the Multi-Select option. If enabled, the Dashboard user will be able to enable and disable individual variables.

The Multi-Select functionality is taken a step further with the introduction of Multi-Select Tagging. This functionality allows you to group individual Template variables together under a Tag or Group name.

For example, if you were using Templating to list all 20 of your applications, you could use Multi-Select Tagging to group your applications by function or region or criticality, etc.

 > Note: Multi-Select Tagging functionality is currently experimental but is part of Grafana 2.1. To enable this feature click the enable icon when editing Template options for a particular variable.

<img class="no-shadow" src="/img/docs/v2/template-tags-config.png">

Grafana gets the list of tags and the list of values in each tag by performing two queries on your metric namespace.

The Tags query returns a list of Tags.

The Tag values query returns the values for a given Tag.

Note: a proof of concept shim that translates the metric query into a SQL call is provided. This allows you to maintain your tag:value mapping independently of your Data Source.

Once configured, Multi-Select Tagging provides a convenient way to group and your template variables, and slice your data in the exact way you want. The Tags can be seen on the right side of the template pull-down.

![](/img/docs/v2/multi-select.gif)

### Interval

Use the `Interval` type to create Template variables around time ranges (eg. `1m`,`1h`, `1d`). There is also a special `auto` option that will change depending on the current time range, you can specify how many times the current time range should be divided to calculate the current `auto` range.

![](/img/docs/v2/templated_variable_parameter.png)

### Custom

Use the `Custom` type to manually create Template variables around explicit values that are hard-coded into the Dashboard, and not dependent on any Data Source. You can specify multiple Custom Template values by separating them with a comma.

##  Repeating Panels and Repeating Rows

Template Variables can be very useful to dynamically change what you're visualizing on a given panel. Sometimes, you might want to create entire new Panels (or Rows) based on what Template Variables have been selected. This is now possible in Grafana 2.1.

Once you've got your Template variables (of any type) configured the way you'd like, check out the Repeating Panels and Repeating Row documentation

## Screencast - Templated Graphite Queries

<iframe width="561" height="315" src="//www.youtube.com/embed/FhNUrueWwOk?list=PLDGkOdUX1Ujo3wHw9-z5Vo12YLqXRjzg2" frameborder="0" allowfullscreen></iframe>

