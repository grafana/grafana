+++
title = "Chained variables"
keywords = ["grafana", "templating", "variable", "nested", "chained", "linked"]
type = "docs"
[menu.docs]
weight = 600
+++

# Chained variables

_Chained variables_, also called _linked variables_ or _nested variables_, are query variables with one or more other variables in their variable query.

You can use chained variable queries in any data source that allows them.


Queries are different for every data source, but the premise is the same.

Extremely complex linked templated dashboards are possible, 5 or 10 levels deep. Technically, there is no limit to how deep or complex you can go.

Variables are useful to reuse dashboards, dynamically change what is shown in dashboards.

Chained variables are especially useful to filter what you see.

Create parent/child relationship in variable, sort of a tree structure where you can select different levels of filters

For example, if you have several applications, each with a different set of servers, you could make separate variables for each metric source, but then you have to know which server goes with which app. A better solution is to use one variable to filter another. In this example, when the user changes the value of the app variable, it changes the dropdown options returned by the server variable.

apps.* - Give me all applications
apps.$app - Give me all servers for the currently chosen application. Uses the value of the first variable in the query.
apps.$app.$server.cpu.* - Show me the CPU metrics for the selected server

Order the variables to make it easy for the user to understand what makes sense. Nested variable relationships are not viewable in the UI.

InfluxDB Templated - data centers. Only options available for region/datacenter selected are available. Later variables options are filtered by earlier selections.

