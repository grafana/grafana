----
page_title: Templated dashboards
page_description: Templated dashboards
page_keywords: grafana, templating, variables, guide,  documentation
---

# Templated Dashboards
![](/img/v2/templating_var_list.png)

## Overview
Templating allows you to create dashboard variables that can be used in your metric queries, series
names and panel titles. Use this feature to create generic dashboards that can quickly be
changed to show graphs for different servers or metrics.

You find this feature in the dashboard cog dropdown menu.

## Variable types
There are three different types of template variables. They can all be used in the
same way but they differ in how the list variables values is created.

### Query
This is the most common type of variable. It allows you to create a variable
with values fetched directly from a data source via a metric exploration query.

For example a query like `prod.servers.*` will fill the variable with all possible
values that exists in the wildcard position (Graphite example).

You can also create nested variables that use other variables in their definition. For example
`apps.$app.servers.*` uses the variable `$app` in its query definition.

> For examples of template queries appropriate for your data source checkout the documentation
> page for your data source.

### Interval
This variable type is useful for time ranges like `1m`,`1h`, `1d`. There is also an auto
option that will change depending on the current time range, you can specify how many times
the current time range should be divided to calculate the current `auto` range.

![](/img/v2/templated_variable_parameter.png)

### Custom
This variable type allow you to manually specify all the different values as a comma seperated
string.

## Screencast - Templated Graphite Queries
<iframe width="561" height="315" src="//www.youtube.com/embed/FhNUrueWwOk?list=PLDGkOdUX1Ujo3wHw9-z5Vo12YLqXRjzg2" frameborder="0" allowfullscreen></iframe>

