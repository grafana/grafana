---
aliases:
  - ../variables/ # /docs/grafana/<GRAFANA VERSION>/variables/
  - ../variables/templates-and-variables/ # /docs/grafana/<GRAFANA VERSION>/variables/templates-and-variables/
  - ../variables/variable-examples/ # /docs/grafana/<GRAFANA VERSION>/variables/variable-examples/
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Variables
description: Add variables to metric queries and panel titles to create interactive and dynamic dashboards
weight: 800
---

# Variables

A variable is a placeholder for a value.
When you change the value, the element using the variable will change to reflect the new value.

Variables are displayed as drop-down lists at the top of the dashboard.
These lists make it easy to update the variable value and thus change the data being displayed in your dashboard.

For example, if you needed to monitor several servers, you _could_ make a dashboard for each server.
Or you could create one dashboard and use panels with variables like this one, where you can change the server using the variable selector:

{{< figure src="/static/img/docs/v50/variables_dashboard.png" alt="Variable drop-down open and two values selected" >}}

Variables allow you to create more interactive dashboards.
Instead of hard-coding things like server, application, and sensor names in your metric queries, you can use variables in their place.
They're useful for administrators who want to allow Grafana viewers to adjust visualizations without giving them full editing permissions.

Using variables also allows you to single-source dashboards.
If you have multiple identical data sources or servers, you can make one dashboard and use variables to change what you are viewing.
This simplifies maintenance and upkeep enormously.

{{< youtube id="mMUJ3iwIYwc" >}}

You can use variables in:

- Metric queries
- Panel repeating options
- Dashboard and panel links
- Titles
- Descriptions

To see variable settings, navigate to **Dashboard Settings > Variables**.
Click a variable in the list to see its settings.

{{< docs/play title="Templating - Global variables and interpolation" url="https://play.grafana.org/d/HYaGDGIMk/" >}}

## Template variables {#templates}

A _template_ is any query that contains a variable.
Queries with text that starts with `$` are templates.

For example, if you were administering a dashboard to monitor several servers, you _could_ make a dashboard for each server.
Or you could create one dashboard and use panels with template queries like this one:

```
wmi_system_threads{instance=~"$server"}
```

<!-- add a screenshot for the example -->

In our documentation and in the application, we generally just refer to a _template query_ as a _query_, but we often use the terms _variable_ and _template variable_ interchangeably.

## Additional Examples

The following dashboards in Grafana Play provide examples of template variables:

- [Templating, repeated panels](https://play.grafana.org/d/000000025/) - Using query variables to control how many panels appear.
- [Templated Dynamic Dashboard](https://play.grafana.org/d/000000056/) - Uses query variables, chained query variables, an interval variable, and a repeated panel.
- [Templating - Nested Variables Drilldown](https://play.grafana.org/d/testdata-nested-variables-drilldown/)

## Variable best practices

- Variable drop-down lists are displayed in the order they are listed in the variable list in dashboard settings.
- Put the variables that you will change often at the top, so they will be shown first (far left on the dashboard).
- By default, variables don't have a default value. This means that the topmost value in the drop-down is always preselected. If you want to pre-populate a variable with an empty value, you can use the following workaround in the variable settings:
  1. Select the **Include All Option** checkbox.
  2. In the **Custom all value** field, enter a value like `+`.

## Next steps

The following topics describe how to add and manage variables in your dashboards:

{{< section >}}
