----
page_title: Templated dashboards
page_description: Templated dashboards
page_keywords: grafana, templating, variables, guide,  documentation
---

# Templated Dashboards
![](/img/v2/templating_var_list.png)

## Overview

Templating allows your Dashboards to be more interactive and dynamic. You can create Template variables that can be used practically anywhere in Grafana: metric queries on individual panels, series names, and titles.

Quickly change Template variables to show different graphs and metrics for different server and applications.

You can find and configure the Templating for a particular Dashboard by clicking the dropdown cog on the top of the Dashboard when viewing it.

## Variable types

There are three different types of Template variables. They can all be used to create dynamic variables that you can use throughout the Dashboard. They differ slightly in how they create values.

### Query

> The Query type is often Data Source specific. Please consult the appropriate documentation for your particular Data Source.

This is the most common type of Template variable. Using the Query type to generate a dynamic list of variables, simply by allowing Grafana to explore your Data Source metric namespace when the Dashboard loads.

For example a query like `prod.servers.*` will fill the variable with all possible values that exists in that wildcard position (in the case of the Graphite Data Source). 

You can even create nested variables that use other variables in their definition. For example `apps.$app.servers.*` uses the variable `$app` in its own query definition.

You can utilize the special "All" value to allow the Dashboard user to query for every single Query variable returned. Grafana will automatically translate All into the appropriate format for your Data Source. 

As of Grafana 2.1, it is now possible to select a subset of Query Template variables (previously it was possible to select an individual value or 'All', not multiple values that were less than All). This is accomplished via the Multi-Select option. If enabled, the Dashboard user will be able to enable and disable individual variables. 

### Interval

Use the Interval type to create Template variables aroundr time ranges (eg. `1m`,`1h`, `1d`). There is also a special `auto` option that will change depending on the current time range, you can specify how many times the current time range should be divided to calculate the current `auto` range.

![](/img/v2/templated_variable_parameter.png)

### Custom

Use the Custom type to manually create Template variables around explicit values that are hard coded in the Dashboard and not dependent on any Data Source. You can specify multiple Custom Template values by separating them with a comma. 

## Utilizing Template Variables with Repeating Panels and Repeating Rows

Template Variables can be very useful to dynamically change what you're visualizing on a given panel. Sometimes, you might want to create entire new Panels (or Rows) based on what Template Variables have been selected. This is now possible in Grafana 2.1.

Once you've got your Template variables (of any type) configured the way you'd like, check out the Repeating Panels and Repeating Row documentatione

## Screencast - Templated Graphite Queries

<iframe width="561" height="315" src="//www.youtube.com/embed/FhNUrueWwOk?list=PLDGkOdUX1Ujo3wHw9-z5Vo12YLqXRjzg2" frameborder="0" allowfullscreen></iframe>

