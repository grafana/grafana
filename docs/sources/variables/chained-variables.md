+++
title = "Chained variables"
keywords = ["grafana", "templating", "variable", "nested", "chained", "linked"]
type = "docs"
[menu.docs]
weight = 600
+++

# Chained variables

_Chained variables_, also called _linked variables_ or _nested variables_, are query variables with one or more other variables in their variable query. This page explains how chained variables work and provides links to example dashboards that use chained variables.

Chained variable queries are different for every data source, but the premise is the same for all. You can use chained variable queries in any data source that allows them.

Extremely complex linked templated dashboards are possible, 5 or 10 levels deep. Technically, there is no limit to how deep or complex you can go, but the more links you have, the greater the query load.

## Dashboard examples

The following dashboards contain fairly simple chained variables, only two layers deep. To view the variables and their settings, click **Dashboard settings** (gear icon) and then click **Variables**. Both examples are expanded in the following section.

- [Graphite Templated Nested](https://play.grafana.org/d/000000056/graphite-templated-nested?orgId=1&var-app=country&var-server=All&var-interval=1h)
- [InfluxDB Templated](https://play.grafana.org/d/000000002/influxdb-templated?orgId=1)

## Longer explanation and example

Variables are useful to reuse dashboards, dynamically change what is shown in dashboards. Chained variables are especially useful to filter what you see.

Create parent/child relationship in variable, sort of a tree structure where you can select different levels of filters


### Graphite example

For example, if you have several applications, each with a different set of servers, you could make separate variables for each metric source, but then you have to know which server goes with which app. A better solution is to use one variable to filter another. In this example, when the user changes the value of the app variable, it changes the dropdown options returned by the server variable.

apps.* - Give me all applications
apps.$app - Give me all servers for the currently chosen application. Uses the value of the first variable in the query.
apps.$app.$server.cpu.* - Show me the CPU metrics for the selected server

Order the variables to make it easy for the user to understand what makes sense. Nested variable relationships are not viewable in the UI.

### InfluxDB example

InfluxDB Templated - data centers. Only options available for region/datacenter selected are available. Later variables options are filtered by earlier selections. 9:30

Easiest way is to copy the variable you want to build on and then add another condition. 





Nested variables will mostly be query variables, in some cases might make sense for custom as wll.

## Best practices and tips

The following practices will make your dashboards and variables easier to use.

### Creating new linked variables

- Chaining variables create parent/child dependencies. You can envision them as a ladder or a tree.
- The easiest way to create a new chained variable is to copy the variable that you want to base the new one on. In the variable list, click the **Duplicate variable** icon to the right of the variable entry to create a copy. You can then add on to the query for the parent variable.
- New variables created this way appear at the bottom of the list. You might need to drag it to a different position in the list to get it into a logical order.

### Variable order

You can change the orders of variables in the dashboard variable list by clicking the up and down arrows on the right side of each entry. Grafana lists variable dropdowns left to right according to this list, with the variable at the top on the far left.

- List variables that do not have dependencies at the top.
- Each variable should follow the one it is dependent on.
- Remember there is no indication in the UI of which variables have dependency relationships. List the variables in a logical order to make it easy on other users (and yourself).

### Complexity consideration

The more layers of dependency you have in variables, the longer it will take to update dashboards after you change variables.

For example, if you have a series of four linked variables (country, region, server, metric) and you change a root variable value (country), then Grafana must run queries for all the dependent variables before it updates the visualizations in the dashboard.
