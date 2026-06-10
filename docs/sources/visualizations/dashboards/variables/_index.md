---
aliases:
  - ../../variables/ # /docs/grafana/next/variables/
  - ../../variables/templates-and-variables/ # /docs/grafana/next/variables/templates-and-variables/
  - ../../variables/variable-examples/ # /docs/grafana/next/variables/variable-examples/
  - ../../dashboards/variables/ # /docs/grafana/next/dashboards/variables/
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

Variables are displayed as drop-down lists (or in some cases text fields) at the top of the dashboard.
These drop-down lists make it easy to update the variable value and thus change the data being displayed in your dashboard.

For example, if you needed to monitor several servers, you _could_ make a dashboard for each server.
Or you could create one dashboard and use panels with variables like this one, where you can change the server using the variable selector:

{{< figure src="/media/docs/grafana/dashboards/screenshot-selected-variables-v12.png" max-width="750px" alt="Variable drop-down open and two values selected" >}}

Variables allow you to create more interactive dashboards.
Instead of hard-coding things like server, application, and sensor names in your metric queries, you can use variables in their place.
They're useful for administrators who want to allow Grafana viewers to adjust visualizations without giving them full editing permissions.

Using variables also allows you to single-source dashboards.
If you have multiple identical data sources or servers, you can make one dashboard and use variables to change what you are viewing.
This simplifies maintenance and upkeep enormously.

{{< youtube id="mMUJ3iwIYwc" >}}

You can use variables in:

- Data source queries
- [Panel repeating options](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-panel-options/#configure-repeating-panels)
- [Dashboard and panel links](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/manage-dashboard-links/)
- Titles
- Descriptions
- [Transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/)

To work with variables, you typically do the following:

1. Choose the type of variable that matches the value you want viewers to control.
1. Add the variable to the dashboard.
1. Use the variable in queries, titles, links, or other dashboard fields.
1. Manage the variable order, dependencies, and URL behavior as the dashboard grows.

To see variable settings, click **Edit** in the top-right corner of the dashboard, click the **Dashboard options** icon, click **Settings**, and then click **Variables**.

{{< docs/play title="Templating - Interactive dashboard" url="https://play.grafana.org/goto/B9Xog68Hg?orgId=1" >}}

## Variables you create and global variables

Grafana supports two broad kinds of variables:

- **Variables you create**: Dashboard-specific variables that you define and configure. Use these variables when viewers need to choose values such as a server, data source, region, environment, or interval. For configuration steps, refer to [Add variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/).
- **Global variables**: Built-in variables that Grafana provides automatically, such as the current time range, dashboard name, organization, or signed-in user. For the full reference, refer to [Global variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/global-variables/).

## Choose a variable type

Choose a variable type based on how you want Grafana to get the value and how users interact with it.

| Variable type | Use when                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| Query         | The list of values comes from a data source query, such as server names, metric names, label values, or data centers. |
| Custom        | You want to define a fixed list of values manually.                                                                   |
| Text box      | Viewers need to enter a free-form value.                                                                              |
| Constant      | A dashboard needs a reusable value that viewers don't change.                                                         |
| Data source   | Viewers need to switch a dashboard or query between data source instances.                                            |
| Interval      | Viewers need to change the time grouping or aggregation interval in queries.                                          |
| Filters       | Viewers need dashboard-wide key/value filters for supported data sources.                                             |
| Switch        | Viewers need to toggle between two configured values.                                                                 |

For the complete list of variable settings and type-specific steps, refer to [Add variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/).

## Template variables {#templates}

A _template_ is any query that contains a variable.
Queries with text that starts with `$` are templates.
For example, if you administer a dashboard that monitors several servers, it can have panels that use a template query like this one:

{{< admonition type="note">}}
Grafana documentation and the application typically refer to a _template query_ as a _query_, but the terms _variable_ and _template variable_ are often used interchangeably.
{{< /admonition >}}

```text
groupByNode(movingAverage(apps.$app.$server.counters.requests.count, 10), 2, 'sum')
```

The following image shows a panel in edit mode using the query:

{{< figure src="/media/docs/grafana/dashboards/screenshot-template-query-v12.1.png" max-width="750px" alt="A panel using a template query" >}}

### Variables in URLs

By default, variable values are synced to the URL using [query parameter syntax](hhttps://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/variable-syntax/#query-parameters), `var-<varname>=value`.
For example:

```text
https://play.grafana.org/d/HYaGDGIMk/templating-global-variables-and-interpolation?orgId=1&from=now-6h&to=now&timezone=utc&var-Server=CCC&var-MyCustomDashboardVariable=Hello%20World%21
```

In the preceding example, the variables and values are `var-Server=CCC` and `var-MyCustomDashboardVariable=Hello%20World%21`.

You can prevent a variable from being synced to the URL by setting `skipUrlSync` to `true` in the variable definition within the dashboard JSON model. When set, the variable value won't appear as a `var-` query parameter in the URL.

This is useful when you want to keep URLs clean, prevent users from overriding a variable value through the URL, or avoid exposing sensitive values in shared links.

{{< admonition type="note">}}
Constant variables have `skipUrlSync` set to `true` by default, since their value is fixed and not intended to be changed through the URL.
{{< /admonition >}}

For more information about URL variables, shared links, time ranges, and filters, refer to [Create dashboard URL variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard-url-variables/).

## Additional examples

The following dashboards in Grafana Play provide examples of template variables:

- [Templating - Repeated panels](https://play.grafana.org/goto/yfZOReUNR?orgId=1) - Using query variables to control how many panels appear in a dashboard.
- [Templating - Nested Variables Drilldown](https://play.grafana.org/d/testdata-nested-variables-drilldown/) - Demonstrates how changing one variable value can change the values available in a nested variable.
- [Templating - Global variables and interpolation](https://play.grafana.org/d/HYaGDGIMk/) - Shows you how the syntax for Grafana variables works.

## Next steps

Use the following topics based on what you want to do next:

- To create dashboard-specific variables, refer to [Add variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/).
- To use built-in variables for time ranges, users, organizations, or query intervals, refer to [Global variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/global-variables/).
- To configure chained variables, multi-property variables, or regular expression filtering, refer to [Advanced variable usage](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/advanced-variables/).
- To control how Grafana interpolates variable values, refer to [Variable syntax](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/variable-syntax/).
- To reorder, clone, delete, or inspect variable dependencies, refer to [Manage and inspect variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/inspect-variable/).

The following pages contain the full variables documentation:

{{< section >}}
