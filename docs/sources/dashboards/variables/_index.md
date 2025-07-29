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

To see variable settings, navigate to **Dashboard Settings > Variables**.
Click a variable in the list to see its settings.

{{< docs/play title="Templating - Interactive dashboard" url="https://play.grafana.org/goto/B9Xog68Hg?orgId=1" >}}

## Template variables {#templates}

A _template_ is any query that contains a variable.
Queries with text that starts with `$` are templates.

{{< admonition type="note">}}
In our documentation and in the application, we typically simply refer to a _template query_ as a _query_, but we often use the terms _variable_ and _template variable_ interchangeably.
{{< /admonition >}}

For example, if you were administering a dashboard to monitor several servers, it could have panels that use template queries like this one:

```text
groupByNode(movingAverage(apps.$app.$server.counters.requests.count, 10), 2, 'sum')
```

The following image shows a panel in edit mode using the query:

{{< figure src="/media/docs/grafana/dashboards/screenshot-template-query-v12.1.png" max-width="750px" alt="A panel using a template query" >}}

### Variables in URLs

Variable values are always synced to the URL using [query parameter syntax](https://grafana.com/docs/grafana/latest/dashboards/variables/variable-syntax/#query-parameters), `var-<varname>=value`.
For example:

```text
https://play.grafana.org/d/HYaGDGIMk/templating-global-variables-and-interpolation?orgId=1&from=now-6h&to=now&timezone=utc&var-Server=CCC&var-MyCustomDashboardVariable=Hello%20World%21
```

In the preceding example, the variables and values are `var-Server=CCC` and `var-MyCustomDashboardVariable=Hello%20World%21`.

## Additional examples

The following dashboards in Grafana Play provide examples of template variables:

- [Templating - Repeated panels](https://play.grafana.org/goto/yfZOReUNR?orgId=1) - Using query variables to control how many panels appear in a dashboard.
- [Templating - Nested Variables Drilldown](https://play.grafana.org/d/testdata-nested-variables-drilldown/) - Demonstrates how changing one variable value can change the values available in a nested variable.
- [Templating - Global variables and interpolation](https://play.grafana.org/d/HYaGDGIMk/) - Shows you how the syntax for Grafana variables works.

## Next steps

The following topics describe how to add and manage variables in your dashboards:

{{< section >}}
